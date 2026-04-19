import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'meeting-genius-secret-key-2026'

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sections } = await request.json()
    if (!sections || !Array.isArray(sections)) {
      return NextResponse.json({ error: 'Missing or invalid sections array' }, { status: 400 })
    }

    const supabase = createClient()
    
    const results = await Promise.all(
      sections.map((section: { id: number; order_index: number }) =>
        supabase
          .from('sections')
          .update({ order_index: section.order_index })
          .eq('id', section.id)
      )
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
