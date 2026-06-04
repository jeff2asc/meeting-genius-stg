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
      return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { searchParams } = new URL(request.url)
    const buildingId = searchParams.get('building_id')
    const buildingIdsParam = searchParams.get('building_ids')

    const supabase = createClient()
    
    // 1. Get Meeting IDs
    let meetingQuery = supabase.from('meetings').select('id')
    if (buildingId) {
      meetingQuery = meetingQuery.eq('building_id', parseInt(buildingId))
    } else if (buildingIdsParam) {
      const ids = buildingIdsParam.split(',').map(id => parseInt(id))
      meetingQuery = meetingQuery.in('building_id', ids)
    }

    const { data: meetings, error: meetingsError } = await meetingQuery
    if (meetingsError) throw meetingsError
    
    const meetingIds = meetings?.map(m => m.id) || []
    if (meetingIds.length === 0) return withCors(request, NextResponse.json({ data: [], success: true }))

    // 2. Get Topics and their Meetings/Buildings
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('id, title, meeting_id, meetings(id, title, building_id, buildings(name))')
      .in('meeting_id', meetingIds)
    if (topicsError) throw topicsError

    // Deduplicate topics by id (a topic could appear under multiple meeting joins)
    const uniqueTopics = Array.from(
      new Map((topics || []).map(t => [t.id, t])).values()
    )
    const topicIds = uniqueTopics.map(t => t.id)
    if (topicIds.length === 0) return withCors(request, NextResponse.json({ data: [], success: true }))

    // 3. Get Tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .in('topic_id', topicIds)
      .order('created_at', { ascending: false })
    if (tasksError) throw tasksError

    // 4. Transform for return — deduplicate tasks by id
    const seenTaskIds = new Set<number>()
    const formattedTasks = (tasks || [])
      .filter(task => {
        if (seenTaskIds.has(task.id)) return false
        seenTaskIds.add(task.id)
        return true
      })
      .map(task => {
        const topic = uniqueTopics.find(t => t.id === task.topic_id)
        const meeting = topic?.meetings as any
        const building = meeting?.buildings as any

        return {
          ...task,
          building_name: building?.name || 'Unknown',
          meeting_title: meeting?.title || 'Unknown',
          topic_title: topic?.title || 'Unknown'
        }
      })

    return withCors(request, NextResponse.json({ data: formattedTasks, success: true }))
  } catch (err: any) {
    return withCors(request, NextResponse.json({ error: err.message }, { status: 500 }))
  }
}
