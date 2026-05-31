import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

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
    const meetingId = parseInt(id)
    const supabase = createAdminClient()

    // 1. Fetch section IDs under this meeting
    const { data: sections, error: secErr } = await supabase
      .from('sections')
      .select('id')
      .eq('meeting_id', meetingId)
    if (secErr) throw secErr
    const sectionIds = (sections || []).map(s => s.id)

    // 2. Fetch topic IDs under this meeting
    const { data: topics, error: topErr } = await supabase
      .from('topics')
      .select('id')
      .eq('meeting_id', meetingId)
    if (topErr) throw topErr
    const topicIds = (topics || []).map(t => t.id)

    // 3. Fetch task IDs under these topics
    let taskIds: number[] = []
    if (topicIds.length > 0) {
      const { data: tasks, error: taskErr } = await supabase
        .from('tasks')
        .select('id')
        .in('topic_id', topicIds)
      if (taskErr) throw taskErr
      taskIds = (tasks || []).map(t => t.id)
    }

    // --- Deletions starting from lowest children ---

    // 4. Delete task-related dependencies
    if (taskIds.length > 0) {
      const { error: errTaskNotes } = await supabase.from('task_notes').delete().in('task_id', taskIds)
      if (errTaskNotes) throw errTaskNotes

      const { error: errTaskAtts } = await supabase.from('task_attachments').delete().in('task_id', taskIds)
      if (errTaskAtts) throw errTaskAtts

      const { error: errTaskAnalyses } = await supabase.from('task_analyses').delete().in('task_id', taskIds)
      if (errTaskAnalyses) throw errTaskAnalyses
    }

    // 5. Delete tasks
    if (topicIds.length > 0) {
      const { error: errTasks } = await supabase.from('tasks').delete().in('topic_id', topicIds)
      if (errTasks) throw errTasks
    }

    // 6. Delete decisions (nullify parents first if self-references exist)
    if (topicIds.length > 0) {
      const { error: errNullDecisions } = await supabase
        .from('decisions')
        .update({ parent_decision_id: null })
        .in('topic_id', topicIds)
      if (errNullDecisions) throw errNullDecisions

      const { error: errDecisions } = await supabase.from('decisions').delete().in('topic_id', topicIds)
      if (errDecisions) throw errDecisions
    }

    // 7. Delete notes, topic attachments, ai_analyses
    if (topicIds.length > 0) {
      const { error: errNotes } = await supabase.from('notes').delete().in('topic_id', topicIds)
      if (errNotes) throw errNotes

      const { error: errTopicAtts } = await supabase.from('topic_attachments').delete().in('topic_id', topicIds)
      if (errTopicAtts) throw errTopicAtts

      const { error: errAiAnalyses } = await supabase.from('ai_analyses').delete().in('topic_id', topicIds)
      if (errAiAnalyses) throw errAiAnalyses
    }

    // 8. Delete topics
    const { error: errTopics } = await supabase.from('topics').delete().eq('meeting_id', meetingId)
    if (errTopics) throw errTopics

    // 9. Delete section attachments
    if (sectionIds.length > 0) {
      const { error: errSecAtts } = await supabase.from('section_attachments').delete().in('section_id', sectionIds)
      if (errSecAtts) throw errSecAtts
    }

    // 10. Delete sections
    const { error: errSections } = await supabase.from('sections').delete().eq('meeting_id', meetingId)
    if (errSections) throw errSections

    // 11. Delete transcripts
    const { error: errTranscripts } = await supabase.from('meeting_transcripts').delete().eq('meeting_id', meetingId)
    if (errTranscripts) throw errTranscripts

    // 12. Delete meeting itself
    const { error: errMeeting } = await supabase.from('meetings').delete().eq('id', meetingId)
    if (errMeeting) throw errMeeting

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    try {
      const apiKey = request.headers.get('x-api-key')
      if (!apiKey || apiKey !== VALID_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
  
      const { id } = await params
      const supabase = createClient()
      const { data, error } = await supabase
        .from('meetings')
        .select('*, buildings(name, company_id)')
        .eq('id', parseInt(id))
        .single()
  
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
  
    return NextResponse.json({ data, success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

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

    const supabase = createClient()
    const { error } = await supabase
      .from('meetings')
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
