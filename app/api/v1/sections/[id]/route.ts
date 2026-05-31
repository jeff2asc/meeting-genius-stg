import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

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
    const updates = await request.json()

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('sections')
      .update(updates)
      .eq('id', parseInt(id))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const sectionId = parseInt(id)
    const supabase = createAdminClient()

    // 1. Get all topics in this section
    const { data: topics, error: topErr } = await supabase
      .from('topics')
      .select('id')
      .eq('section_id', sectionId)
    if (topErr) throw topErr
    const topicIds = (topics || []).map(t => t.id)

    // 2. Get all tasks under those topics
    let taskIds: number[] = []
    if (topicIds.length > 0) {
      const { data: tasks, error: taskErr } = await supabase
        .from('tasks')
        .select('id')
        .in('topic_id', topicIds)
      if (taskErr) throw taskErr
      taskIds = (tasks || []).map(t => t.id)
    }

    // 3. Delete task children
    if (taskIds.length > 0) {
      const { error: e1 } = await supabase.from('task_notes').delete().in('task_id', taskIds)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('task_attachments').delete().in('task_id', taskIds)
      if (e2) throw e2
      const { error: e3 } = await supabase.from('task_analyses').delete().in('task_id', taskIds)
      if (e3) throw e3
    }

    // 4. Delete tasks
    if (topicIds.length > 0) {
      const { error: e } = await supabase.from('tasks').delete().in('topic_id', topicIds)
      if (e) throw e
    }

    // 5. Delete decisions (nullify parent refs first)
    if (topicIds.length > 0) {
      await supabase.from('decisions').update({ parent_decision_id: null }).in('topic_id', topicIds)
      const { error: e } = await supabase.from('decisions').delete().in('topic_id', topicIds)
      if (e) throw e
    }

    // 6. Delete notes, topic attachments, ai_analyses
    if (topicIds.length > 0) {
      const { error: e1 } = await supabase.from('notes').delete().in('topic_id', topicIds)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('topic_attachments').delete().in('topic_id', topicIds)
      if (e2) throw e2
      const { error: e3 } = await supabase.from('ai_analyses').delete().in('topic_id', topicIds)
      if (e3) throw e3
    }

    // 7. Delete topics
    if (topicIds.length > 0) {
      const { error: e } = await supabase.from('topics').delete().in('id', topicIds)
      if (e) throw e
    }

    // 8. Delete section attachments
    const { error: saErr } = await supabase.from('section_attachments').delete().eq('section_id', sectionId)
    if (saErr) throw saErr

    // 9. Delete the section itself
    const { error } = await supabase.from('sections').delete().eq('id', sectionId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
