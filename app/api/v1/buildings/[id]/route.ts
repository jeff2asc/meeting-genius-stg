import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

export async function PATCH(
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
    const adminClient = createAdminClient()

    const updatePayload = {
      ...body,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await adminClient
      .from('buildings')
      .update(updatePayload)
      .eq('id', buildingId)
      .select()
      .single()

    if (error) {
      console.error('Database error updating building:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, success: true })
  } catch (err: any) {
    console.error('Unexpected error in building PATCH route:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
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

    const adminClient = createAdminClient()

    // 1. Get all meetings for this building
    const { data: meetings, error: meetingsErr } = await adminClient
      .from('meetings')
      .select('id')
      .eq('building_id', buildingId)
    if (meetingsErr) throw meetingsErr
    const meetingIds = (meetings || []).map(m => m.id)

    if (meetingIds.length > 0) {
      // 2. Get all sections under these meetings
      const { data: sections, error: secErr } = await adminClient
        .from('sections')
        .select('id')
        .in('meeting_id', meetingIds)
      if (secErr) throw secErr
      const sectionIds = (sections || []).map(s => s.id)

      // 3. Get all topics under these meetings
      const { data: topics, error: topErr } = await adminClient
        .from('topics')
        .select('id')
        .in('meeting_id', meetingIds)
      if (topErr) throw topErr
      const topicIds = (topics || []).map(t => t.id)

      if (topicIds.length > 0) {
        // 4. Get task IDs for child cleanup
        const { data: tasks, error: taskErr } = await adminClient
          .from('tasks')
          .select('id')
          .in('topic_id', topicIds)
        if (taskErr) throw taskErr
        const taskIds = (tasks || []).map(t => t.id)

        // 5. Delete task children
        if (taskIds.length > 0) {
          await adminClient.from('task_notes').delete().in('task_id', taskIds)
          await adminClient.from('task_attachments').delete().in('task_id', taskIds)
          await adminClient.from('task_analyses').delete().in('task_id', taskIds)
        }

        // 6. Delete tasks
        const { error: errTasks } = await adminClient.from('tasks').delete().in('topic_id', topicIds)
        if (errTasks) throw errTasks

        // 7. Delete decisions (nullify self-refs first)
        await adminClient.from('decisions').update({ parent_decision_id: null }).in('topic_id', topicIds)
        const { error: errDecisions } = await adminClient.from('decisions').delete().in('topic_id', topicIds)
        if (errDecisions) throw errDecisions

        // 8. Delete notes, topic attachments, ai_analyses
        await adminClient.from('notes').delete().in('topic_id', topicIds)
        await adminClient.from('topic_attachments').delete().in('topic_id', topicIds)
        await adminClient.from('ai_analyses').delete().in('topic_id', topicIds)

        // 9. Delete topics
        const { error: errTopics } = await adminClient.from('topics').delete().in('meeting_id', meetingIds)
        if (errTopics) throw errTopics
      }

      // 10. Delete section attachments
      if (sectionIds.length > 0) {
        await adminClient.from('section_attachments').delete().in('section_id', sectionIds)
      }

      // 11. Delete sections
      const { error: errSections } = await adminClient.from('sections').delete().in('meeting_id', meetingIds)
      if (errSections) throw errSections

      // 12. Delete transcripts
      await adminClient.from('meeting_transcripts').delete().in('meeting_id', meetingIds)

      // 13. Delete meetings
      const { error: errMeetings } = await adminClient.from('meetings').delete().in('id', meetingIds)
      if (errMeetings) throw errMeetings
    }

    // 14. Delete tasks directly on building_id
    await adminClient.from('tasks').delete().eq('building_id', buildingId)

    // 15. Delete building documents
    await adminClient.from('building_documents').delete().eq('building_id', buildingId)

    // 16. Remove user-building associations
    const { error: userBuildingsError } = await adminClient
      .from('user_buildings')
      .delete()
      .eq('building_id', buildingId)
    if (userBuildingsError) throw userBuildingsError

    // 17. Delete the building
    const { error: errBuilding } = await adminClient
      .from('buildings')
      .delete()
      .eq('id', buildingId)
    if (errBuilding) throw errBuilding

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Unexpected error in building DELETE route:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
