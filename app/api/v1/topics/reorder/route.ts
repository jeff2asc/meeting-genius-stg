import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { topics } = await request.json()
    if (!topics || !Array.isArray(topics)) {
      return NextResponse.json({ error: 'Missing or invalid topics array' }, { status: 400 })
    }

    const supabase = createAdminClient()
    
    const results = await Promise.all(
      topics.map((topic: { id: number; order_index: number; section_id?: number }) => {
        const updateData: any = { order_index: topic.order_index }
        if (topic.section_id !== undefined) updateData.section_id = topic.section_id
        
        return supabase
          .from('topics')
          .update(updateData)
          .eq('id', topic.id)
      })
    )

    const errors = results.filter(r => r.error).map(r => r.error?.message)
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Some updates failed', details: errors }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
