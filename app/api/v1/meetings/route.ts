import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { handleOptions, withCors } from '@/lib/cors'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const buildingId = searchParams.get('building_id')
    const buildingIds = searchParams.get('building_ids')

    const supabase = createClient()
    let query = supabase
      .from('meetings')
      .select('*, buildings(name)')
      .order('meeting_date', { ascending: false })

    if (buildingId) {
      query = query.eq('building_id', parseInt(buildingId))
    } else if (buildingIds) {
      const ids = buildingIds.split(',').map(id => parseInt(id))
      query = query.in('building_id', ids)
    }

    const { data, error } = await query

    if (error) {
      return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return withCors(request, NextResponse.json({ data, success: true }))
  } catch (err: any) {
    return withCors(request, NextResponse.json({ error: err.message }, { status: 500 }))
  }
}
