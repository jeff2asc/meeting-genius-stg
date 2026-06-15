import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { validateRequest } from '@/lib/auth-server'
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await validateRequest(request)
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const managerId = searchParams.get('manager_id')
    const buildingIds = searchParams.get('building_ids')
    const showArchived = searchParams.get('archived') === 'true'
    const supabase = createClient()
    let query = supabase.from('buildings').select('*')
    // Filter by archive status
    if (showArchived) {
      query = query.eq('is_archived', true)
    } else {
      // Return active buildings (is_archived is false or null)
      query = query.or('is_archived.eq.false,is_archived.is.null')
    }
    if (companyId) {
      query = query.eq('company_id', parseInt(companyId))
    }
    if (managerId) {
      query = query.eq('manager_id', parseInt(managerId))
    }
    if (buildingIds) {
      const ids = buildingIds.split(',').map(id => parseInt(id))
      query = query.in('id', ids)
    }
    const { data, error } = await query.order('name')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data, success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
