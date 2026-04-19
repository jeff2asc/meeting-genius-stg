import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'meeting-genius-secret-key-2026'

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const managerId = searchParams.get('manager_id')
    const buildingIds = searchParams.get('building_ids')

    const supabase = createClient()
    let query = supabase.from('buildings').select('*')

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
