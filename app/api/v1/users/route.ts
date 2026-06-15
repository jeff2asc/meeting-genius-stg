import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { isAuthorizedRequest } from '@/lib/auth-server'
import bcrypt from 'bcryptjs'

function getUniqueEmail(email: string | null | undefined, userType: string): string {
  const trimmed = email ? email.toLowerCase().trim() : ""
  const isEmailOptional = ["attendee", "owner", "resident"].includes(userType)

  if (!trimmed) {
    if (isEmailOptional) {
      const randomString = Math.random().toString(36).substring(2, 11)
      return `no-email-${Date.now()}-${randomString}@meetinggenius.ca`
    }
    return ""
  }

  // If they entered a generic dummy email, make it unique to prevent overwriting existing records
  const dummyPatterns = [
    'noreply@',
    'no-reply@',
    'dummy@',
    'placeholder@',
    'test@',
    'nomail@',
    'no-email@'
  ]

  const isDummy = dummyPatterns.some(pattern => trimmed.includes(pattern))

  if (isDummy && isEmailOptional) {
    const parts = trimmed.split('@')
    const localPart = parts[0]
    const domainPart = parts[1] || 'meetinggenius.ca'
    const randomString = Math.random().toString(36).substring(2, 7)
    return `${localPart}+${Date.now()}-${randomString}@${domainPart}`
  }

  return trimmed
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const userType = searchParams.get('user_type')
    const userId = searchParams.get('id')
    const includeBuildings = searchParams.get('include_buildings') === 'true'
    const includeNullCompany = searchParams.get('include_null_company') === 'true'

    const supabase = createAdminClient()

    let query = supabase
      .from('users')
      .select('id, name, email, user_type, roles, assigned_pm_id, company_id, voting_weight, created_at, companies(id, name)')
      .order('created_at', { ascending: false })

    if (userId) {
      query = (query as any).eq('id', parseInt(userId))
    }

    if (userType) {
      query = (query as any).eq('user_type', userType)
    }

    if (companyId && includeNullCompany) {
      query = (query as any).or(`company_id.eq.${companyId},company_id.is.null`)
    } else if (companyId) {
      query = (query as any).eq('company_id', parseInt(companyId))
    }

    const { data: usersData, error: usersError } = await query

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    // Optionally fetch user_buildings for building assignment display
    let userBuildingsData: any[] = []
    if (includeBuildings) {
      let ubQuery = supabase
        .from('user_buildings')
        .select('user_id, building_id, unit_number, voting_weight, buildings!inner(id, name, company_id, manager_id)')

      if (companyId) {
        ubQuery = (ubQuery as any).eq('buildings.company_id', parseInt(companyId))
      }

      const { data: ubData } = await ubQuery
      userBuildingsData = ubData || []
    }

    return NextResponse.json({ data: usersData || [], userBuildings: userBuildingsData, success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      name,
      email,
      password,
      user_type,
      roles,
      company_id,
      assigned_pm_id,
      voting_weight,
      buildings
    } = body

    const finalUserType = user_type || 'user'

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const finalEmail = getUniqueEmail(email, finalUserType)

    if (!finalEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, roles, user_type, company_id')
      .eq('email', finalEmail)
      .maybeSingle()

    let userId: number
    const finalRoles = roles || [finalUserType]
    const finalVotingWeight = voting_weight ?? 1.0

    // Hash password if provided
    let passwordHash = null
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10)
      passwordHash = await bcrypt.hash(password.trim(), salt)
    }

    if (existingUser) {
      // Update existing user roles and company
      const existingRoles = Array.isArray(existingUser.roles) ? existingUser.roles : [existingUser.user_type]
      const mergedRoles = Array.from(new Set([...existingRoles, ...finalRoles]))
      
      const updateData: any = {
        name: name.trim(),
        user_type: finalUserType,
        roles: mergedRoles,
        company_id: company_id || existingUser.company_id,
        assigned_pm_id: assigned_pm_id || null,
        voting_weight: finalVotingWeight,
      }

      if (passwordHash) {
        updateData.password_hash = passwordHash
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', existingUser.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
      userId = existingUser.id
    } else {
      // Normal Insert
      const insertData: any = {
        name: name.trim(),
        email: finalEmail,
        password_hash: passwordHash || "$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5", // default if none provided
        user_type: finalUserType,
        roles: finalRoles,
        company_id: company_id || null,
        assigned_pm_id: assigned_pm_id || null,
        voting_weight: finalVotingWeight,
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
      userId = newUser.id
    }

    // Assign buildings
    if (buildings && Array.isArray(buildings)) {
      // Check existing building assignments for user
      const { data: existingAssignments } = await supabase
        .from('user_buildings')
        .select('building_id, unit_number')
        .eq('user_id', userId)

      const existingKeys = (existingAssignments || []).map((a: any) => `${a.building_id}-${a.unit_number || ''}`)
      const newAssignments = buildings.filter((b: any) => !existingKeys.includes(`${b.id}-${b.unit_number || ''}`))

      if (newAssignments.length > 0) {
        const buildingAssignments = newAssignments.map((b: any) => ({
          user_id: userId,
          building_id: b.id,
          unit_number: b.unit_number?.trim() || null,
          voting_weight: parseFloat(b.voting_weight) || 1.0,
          user_building_type: finalUserType
        }))

        const { error: buildingsError } = await supabase
          .from('user_buildings')
          .insert(buildingAssignments)

        if (buildingsError) {
          console.error('Error assigning buildings:', buildingsError)
        }
      }
    }

    return NextResponse.json({ data: { id: userId }, success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      id,
      name,
      email,
      password,
      user_type,
      roles,
      company_id,
      assigned_pm_id,
      voting_weight,
      buildings
    } = body

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const updateData: any = {}
    if (name) updateData.name = name.trim()
    if (email !== undefined) {
      const finalEmail = getUniqueEmail(email, user_type || 'user')
      if (finalEmail) {
        updateData.email = finalEmail
      }
    }
    if (user_type) updateData.user_type = user_type
    if (roles) updateData.roles = roles
    if (company_id !== undefined) updateData.company_id = company_id
    if (assigned_pm_id !== undefined) updateData.assigned_pm_id = assigned_pm_id
    if (voting_weight !== undefined) updateData.voting_weight = voting_weight

    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10)
      updateData.password_hash = await bcrypt.hash(password.trim(), salt)
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Sync buildings if provided
    if (buildings && Array.isArray(buildings)) {
      const { data: existingAssignments } = await supabase
        .from('user_buildings')
        .select('building_id, unit_number')
        .eq('user_id', id)

      const existingSet = new Set(
        (existingAssignments || []).map(
          (a: any) => `${a.building_id}::${a.unit_number ?? ''}`
        )
      )
      const desiredSet = new Set(
        buildings.map(
          (b: any) => `${b.id}::${(b.unit_number?.trim()) ?? ''}`
        )
      )

      // Rows to ADD
      const toInsert = buildings.filter(
        (b: any) => !existingSet.has(`${b.id}::${(b.unit_number?.trim()) ?? ''}`)
      )
      // Rows to REMOVE
      const toDelete = (existingAssignments || []).filter(
        (a: any) => !desiredSet.has(`${a.building_id}::${a.unit_number ?? ''}`)
      )

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('user_buildings')
          .insert(
            toInsert.map((b: any) => ({
              user_id: id,
              building_id: b.id,
              unit_number: b.unit_number?.trim() || null,
              voting_weight: parseFloat(b.voting_weight) || 1.0,
              user_building_type: user_type || 'user',
            }))
          )
        if (insertError) console.error('Error inserting user_buildings:', insertError)
      }

      for (const row of toDelete) {
        let delQuery = supabase
          .from('user_buildings')
          .delete()
          .eq('user_id', id)
          .eq('building_id', row.building_id)
        if (row.unit_number) {
          delQuery = delQuery.eq('unit_number', row.unit_number)
        } else {
          delQuery = delQuery.is('unit_number', null)
        }
        const { error: delError } = await delQuery
        if (delError) console.error('Error removing building assignment:', delError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Delete user_buildings assignments first
    await supabase.from('user_buildings').delete().eq('user_id', parseInt(id))

    // 2. Delete user
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', parseInt(id))

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
