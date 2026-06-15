import { NextRequest, NextResponse } from 'next/server'
import { supabase, createAdminClient } from '@/lib/supabase'
import { rolesFromDbUser } from '@/lib/permissions'
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
    // 1. Validate Authentication (either API Key OR Supabase Session)
    const apiKey = request.headers.get('x-api-key')
    const VALID_API_KEY = process.env.INTERNAL_API_KEY || ''
    let isAuthorized = !!(apiKey && apiKey === VALID_API_KEY)

    if (!isAuthorized) {
      const authHeader = request.headers.get('Authorization')
      console.log('--- Bulk Import Auth Check ---')
      console.log('Authorization Header Present:', !!authHeader)

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1]
        console.log('Token (first 10 chars):', token.substring(0, 10) + '...')

        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        
        if (authError || !user) {
          console.log('Supabase Auth Error:', authError?.message)
          console.log('Supabase Auth User:', user)
        } else {
          console.log('Authenticated User Email:', user.email)

          // Use Admin Client to bypass RLS for permission check
          const adminClient = createAdminClient()
          const { data: userData, error: dbError } = await adminClient
            .from('users')
            .select('user_type, roles')
            .eq('email', user.email!)
            .single()
            
          if (dbError) {
            console.log('Database Lookup Error:', dbError.message)
          } else if (!userData) {
            console.log('No user record found in DB for email:', user.email)
          } else {
            // Use specialized project helper to normalize roles/user_type
            const normalizedRoles = rolesFromDbUser(userData)
            console.log('Normalized Roles for', user.email, ':', normalizedRoles)

            // Align with lib/permissions.ts: user import is allowed for several roles
            const authorizedRoles = ['master', 'corporate_administrator', 'corporate_admin', 'admin', 'property_manager']
            const isAuthorizedUser = normalizedRoles.some(role => authorizedRoles.includes(role))

            console.log('Normalized Roles for', user.email, ':', normalizedRoles)

            if (isAuthorizedUser) {
              console.log('Authorization Granted: Authorized role found in normalized list')
              isAuthorized = true
            } else {
              console.log('Authorization Denied: No authorized role found in', normalizedRoles)
            }
          }
        }
      } else {
        console.log('Authorization Header missing or malformed')
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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
    const DEFAULT_PASSWORD = 'MeetingGenius2026!'

    // ✅ FIXED: Properly hash the default password at runtime
    const defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)


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
            password_hash: passwordHash,
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
