import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { isAuthorizedRequest } from '@/lib/auth-server'

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
      .select('id, name, email, user_type, roles, assigned_pm_id, company_id, created_at, companies(id, name)')
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
        .select('user_id, building_id, unit_number, buildings!inner(id, name, company_id, manager_id)')

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
