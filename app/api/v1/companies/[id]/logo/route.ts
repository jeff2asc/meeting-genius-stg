import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { validateRequest } from '@/lib/auth-server'
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await validateRequest(request)
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const supabase = createClient()
    const { data, error } = await supabase
      .from('companies')
      .select('logo_url')
      .eq('id', parseInt(id))
      .single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ logo_url: data?.logo_url || null, success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
