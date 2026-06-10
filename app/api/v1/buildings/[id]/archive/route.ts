import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const buildingId = parseInt(id)
    if (isNaN(buildingId)) {
      return NextResponse.json({ error: 'Invalid Building ID' }, { status: 400 })
    }

    const body = await request.json()
    const { archived_by, archive_reason } = body

    const adminClient = createAdminClient()

    // 1. Archive the building
    const { data, error } = await adminClient
      .from('buildings')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: archived_by || null,
        archive_reason: archive_reason || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', buildingId)
      .select()
      .single()

    if (error) {
      console.error('Database error archiving building:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 2. Cascade archive to all meetings in this building
    const { error: meetingsError } = await adminClient
      .from('meetings')
      .update({ is_archived: true })
      .eq('building_id', buildingId)

    if (meetingsError) {
      console.error('Error archiving meetings:', meetingsError)
      // Non-fatal — building is archived, log and continue
    }

    return NextResponse.json({ data, success: true })
  } catch (err: any) {
    console.error('Unexpected error in building archive route:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
