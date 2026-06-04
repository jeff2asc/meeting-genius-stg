import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== VALID_API_KEY) return unauthorized()

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')

  const admin = (createAdminClient() as any)
  let query = admin
    .from('supplier_categories')
    .select('*')
    .order('sort_order')
    .order('name')

  if (companyId) query = query.eq('company_id', parseInt(companyId))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== VALID_API_KEY) return unauthorized()

  const body = await request.json()
  const { company_id, name, description, sort_order } = body

  if (!company_id || !name?.trim()) {
    return NextResponse.json({ error: 'company_id and name are required' }, { status: 400 })
  }

  const admin = (createAdminClient() as any)
  const { data, error } = await admin
    .from('supplier_categories')
    .insert({ company_id, name: name.trim(), description: description?.trim() || null, sort_order: sort_order ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}


