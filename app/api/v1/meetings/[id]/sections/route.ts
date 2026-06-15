import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { isAuthorizedRequest } from '@/lib/auth-server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isAuthorizedRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .eq('meeting_id', parseInt(id))
      .order('order_index')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isAuthorizedRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const meetingId = parseInt(id)
    const body = await request.json()

    // Accept either a single section object or an array
    const sectionsInput: { title: string; order_index: number }[] = Array.isArray(body)
      ? body
      : [body]

    const sectionsToInsert = sectionsInput.map(s => ({
      meeting_id: meetingId,
      title: s.title,
      order_index: s.order_index,
    }))

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('sections')
      .insert(sectionsToInsert)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
