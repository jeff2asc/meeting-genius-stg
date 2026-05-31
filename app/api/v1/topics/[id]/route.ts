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
      .from('topics')
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
    const topicId = parseInt(id)
    const supabase = createAdminClient()

    // 1. Get all tasks under this topic
    const { data: tasks, error: taskErr } = await supabase
      .from('tasks')
      .select('id')
      .eq('topic_id', topicId)
    if (taskErr) throw taskErr
    const taskIds = (tasks || []).map(t => t.id)

    // 2. Delete task children
    if (taskIds.length > 0) {
      const { error: e1 } = await supabase.from('task_notes').delete().in('task_id', taskIds)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('task_attachments').delete().in('task_id', taskIds)
      if (e2) throw e2
      const { error: e3 } = await supabase.from('task_analyses').delete().in('task_id', taskIds)
      if (e3) throw e3
    }

    // 3. Delete tasks
    const { error: tasksErr } = await supabase.from('tasks').delete().eq('topic_id', topicId)
    if (tasksErr) throw tasksErr

    // 4. Delete decisions (nullify parent refs first)
    await supabase.from('decisions').update({ parent_decision_id: null }).eq('topic_id', topicId)
    const { error: decisionsErr } = await supabase.from('decisions').delete().eq('topic_id', topicId)
    if (decisionsErr) throw decisionsErr

    // 5. Delete notes, topic attachments, ai_analyses
    const { error: notesErr } = await supabase.from('notes').delete().eq('topic_id', topicId)
    if (notesErr) throw notesErr
    const { error: attsErr } = await supabase.from('topic_attachments').delete().eq('topic_id', topicId)
    if (attsErr) throw attsErr
    const { error: aiErr } = await supabase.from('ai_analyses').delete().eq('topic_id', topicId)
    if (aiErr) throw aiErr

    // 6. Delete the topic itself
    const { error } = await supabase.from('topics').delete().eq('id', topicId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

