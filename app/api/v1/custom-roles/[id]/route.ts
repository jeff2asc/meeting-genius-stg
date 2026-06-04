/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== VALID_API_KEY) return unauthorized()

  const { id } = await context.params
  const body = await request.json()
  const admin = createAdminClient() as any

  const { data, error } = await admin
    .from('custom_roles')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', parseInt(id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== VALID_API_KEY) return unauthorized()

  const { id } = await context.params
  const admin = createAdminClient() as any

  // Prevent deleting global built-in roles
  const { data: role } = await admin.from('custom_roles').select('company_id').eq('id', parseInt(id)).single()
  if (role && role.company_id === null) {
    return NextResponse.json({ error: 'Cannot delete built-in global roles' }, { status: 403 })
  }

  const { error } = await admin
    .from('custom_roles')
    .delete()
    .eq('id', parseInt(id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
