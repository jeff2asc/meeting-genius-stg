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
  // Returns global roles (company_id = null) + company-specific roles
  let query = admin
    .from('custom_roles')
    .select('*')
    .order('name')

  if (companyId) {
    query = query.or(`company_id.is.null,company_id.eq.${parseInt(companyId)}`)
  } else {
    query = query.is('company_id', null)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== VALID_API_KEY) return unauthorized()

  const body = await request.json()
  const { company_id, name, label, description } = body

  if (!name?.trim() || !label?.trim()) {
    return NextResponse.json({ error: 'name and label are required' }, { status: 400 })
  }

  const admin = (createAdminClient() as any)
  const { data, error } = await admin
    .from('custom_roles')
    .insert({
      company_id: company_id || null,
      name: name.trim().toLowerCase().replace(/\s+/g, '_'),
      label: label.trim(),
      description: description?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A role with this name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}


