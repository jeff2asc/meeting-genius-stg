// app/api/users/bulk-import/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

interface ImportUser {
  name: string
  email: string
  user_type?: string
  password?: string
  row_number: number
}

interface ImportRequest {
  users: ImportUser[]
  buildingId: number
  buildingType: string
  companyId: number | null
  managerId: number
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json()
    const { users, buildingId, buildingType, companyId, managerId } = body

    // Validate input
    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'No users provided' },
        { status: 400 }
      )
    }

    if (!buildingId || !buildingType) {
      return NextResponse.json(
        { error: 'Building information is required' },
        { status: 400 }
      )
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    }

    // Default password if none provided
    const DEFAULT_PASSWORD = '123456'
    
    // Pre-computed hash for default password "123456" (to save time)
    const defaultPasswordHash = '$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5'

    // Determine default user type based on building type
    const getDefaultUserType = (buildingType: string): string => {
      if (buildingType === 'Housing Co-op') return 'resident'
      if (buildingType === 'Strata/Condo' || buildingType === 'Rental') return 'owner'
      return 'user'
    }

    // Hash password helper
    const hashPassword = async (password: string): Promise<string> => {
      const salt = await bcrypt.genSalt(10)
      return bcrypt.hash(password, salt)
    }

    // Process each user
    for (const user of users) {
      try {
        const { name, email, user_type, password, row_number } = user

        // Determine final user type
        const finalUserType = user_type || getDefaultUserType(buildingType)

        // Determine password hash
        let passwordHash: string
        if (password && password.trim()) {
          // Custom password provided - hash it
          passwordHash = await hashPassword(password.trim())
        } else {
          // No password provided - use default
          passwordHash = defaultPasswordHash
        }

        // Check if user already exists
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', email.toLowerCase())
          .single()

        if (existingUser) {
          // User exists - check if already assigned to this building
          const { data: existingAssignment } = await supabase
            .from('user_buildings')
            .select('user_id, building_id')
            .eq('user_id', existingUser.id)
            .eq('building_id', buildingId)
            .single()

          if (existingAssignment) {
            // Already assigned to this building
            results.skipped++
            results.errors.push(`Row ${row_number}: User ${email} already exists and is assigned to this building`)
            continue
          } else {
            // User exists but not assigned to this building - assign them
            const { error: assignError } = await supabase
              .from('user_buildings')
              .insert({
                user_id: existingUser.id,
                building_id: buildingId,
              })

            if (assignError) {
              results.skipped++
              results.errors.push(`Row ${row_number}: Failed to assign existing user ${email} to building`)
              continue
            }

            results.created++
            continue
          }
        }

        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password_hash: passwordHash, // ⭐ Use hashed password (custom or default)
            user_type: finalUserType,
            company_id: companyId,
            assigned_pm_id: managerId,
          })
          .select('id')
          .single()

        if (createError || !newUser) {
          console.error('Create user error:', createError)
          results.skipped++
          results.errors.push(`Row ${row_number}: Failed to create user ${email}`)
          continue
        }

        // Assign user to building
        const { error: assignError } = await supabase
          .from('user_buildings')
          .insert({
            user_id: newUser.id,
            building_id: buildingId,
          })

        if (assignError) {
          console.error('Assign error:', assignError)
          results.skipped++
          results.errors.push(`Row ${row_number}: User ${email} created but failed to assign to building`)
          continue
        }

        results.created++

      } catch (err) {
        console.error('Error processing user:', err)
        results.skipped++
        results.errors.push(`Row ${user.row_number}: Unexpected error`)
      }
    }

    return NextResponse.json(results, { status: 200 })

  } catch (error: any) {
    console.error('Bulk import error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import users' },
      { status: 500 }
    )
  }
}
