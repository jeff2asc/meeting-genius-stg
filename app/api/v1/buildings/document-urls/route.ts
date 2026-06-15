import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { isAuthorizedRequest } from '@/lib/auth-server'

export async function DELETE(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'URL ID is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('building_document_urls')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      console.error('[document-urls] Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { building_id, document_type, url, title, description } = body

    if (!building_id || !url || !title) {
      return NextResponse.json({ error: 'building_id, url, and title are required' }, { status: 400 })
    }

    // Validate URL
    try { new URL(url) } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('building_document_urls')
      .insert({
        building_id: Number(building_id),
        document_type: document_type || 'legislation',
        url: url.trim(),
        title: title.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[document-urls] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
