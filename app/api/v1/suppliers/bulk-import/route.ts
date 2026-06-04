import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

interface SupplierRow {
  name: string
  email?: string
  phone?: string
  address?: string
  contact_person?: string
  category?: string
  limit_amount?: string
  approval_gate?: string
  notes?: string
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== VALID_API_KEY) return unauthorized()

  const body = await request.json()
  const { company_id, rows } = body as { company_id: number; rows: SupplierRow[] }

  if (!company_id || !rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'company_id and rows are required' }, { status: 400 })
  }

  const admin = (createAdminClient() as any)

  // Fetch existing categories for this company
  const { data: categories } = await admin
    .from('supplier_categories')
    .select('id, name')
    .eq('company_id', company_id)

  const categoryMap = new Map<string, number>(
    (categories || []).map((c: any) => [c.name.toLowerCase(), c.id])
  )

  const created: any[] = []
  const skipped: any[] = []
  const errors: any[] = []

  for (const row of rows) {
    if (!row.name?.trim()) {
      skipped.push({ row, reason: 'Missing name' })
      continue
    }

    // Auto-create category if it doesn't exist
    let categoryId: number | null = null
    if (row.category?.trim()) {
      const catKey = row.category.trim().toLowerCase()
      if (categoryMap.has(catKey)) {
        categoryId = categoryMap.get(catKey)!
      } else {
        const { data: newCat, error: catError } = await admin
          .from('supplier_categories')
          .insert({ company_id, name: row.category.trim(), sort_order: 0 })
          .select()
          .single()

        if (catError) {
          errors.push({ row, error: catError.message })
          continue
        }
        categoryId = newCat.id
        categoryMap.set(catKey, newCat.id)
      }
    }

    const { data, error } = await admin
      .from('suppliers')
      .insert({
        company_id,
        category_id: categoryId,
        name: row.name.trim(),
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        address: row.address?.trim() || null,
        contact_person: row.contact_person?.trim() || null,
        limit_amount: row.limit_amount ? parseFloat(row.limit_amount) : null,
        approval_gate: row.approval_gate?.trim() || null,
        notes: row.notes?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      errors.push({ row, error: error.message })
    } else {
      created.push(data)
    }
  }

  return NextResponse.json({
    created: created.length,
    skipped: skipped.length,
    errors: errors.length,
    details: { created, skipped, errors }
  })
}


