import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'meeting-genius-secret-key-2026'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, recorder_name, timekeeper_name, attendees } = body

    if (!status) {
      return NextResponse.json({ error: 'Missing status' }, { status: 400 })
    }

    const supabase = createClient()
    const updateData: any = { status }
    
    if (recorder_name) updateData.recorder_name = recorder_name
    if (timekeeper_name) updateData.timekeeper_name = timekeeper_name
    if (attendees) updateData.attendees = attendees

    const { error } = await supabase
      .from('meetings')
      .update(updateData)
      .eq('id', parseInt(id))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
