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
  const categoryId = searchParams.get('category_id')

  const admin = (createAdminClient() as any)
  let query = admin
    .from('suppliers')
    .select('*, category:supplier_categories(id, name, description)')
    .order('name')

  if (companyId) query = query.eq('company_id', parseInt(companyId))
  if (categoryId) query = query.eq('category_id', parseInt(categoryId))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== VALID_API_KEY) return unauthorized()

  const body = await request.json()
  const { company_id, category_id, name, email, phone, address, contact_person, limit_amount, approval_gate, notes } = body

  if (!company_id || !name?.trim()) {
    return NextResponse.json({ error: 'company_id and name are required' }, { status: 400 })
  }

  const admin = (createAdminClient() as any)
  const { data, error } = await admin
    .from('suppliers')
    .insert({
      company_id,
      category_id: category_id || null,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      contact_person: contact_person?.trim() || null,
      limit_amount: limit_amount ? parseFloat(limit_amount) : null,
      approval_gate: approval_gate?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select('*, category:supplier_categories(id, name, description)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}


