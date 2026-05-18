import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

// helper to verify authorization
function isAuthorized(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  return apiKey && apiKey === VALID_API_KEY
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyIdStr = searchParams.get('company_id')
    const companyId = companyIdStr ? parseInt(companyIdStr) : null

    const supabase = createAdminClient()
    let query = supabase
      .from('voting_parameters')
      .select('*')
      .order('value')

    if (companyId !== null && !isNaN(companyId)) {
      query = query.or(`company_id.is.null,company_id.eq.${companyId}`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, company_id, parameter_type, value, description, weight, linked_voting_type } = body

    const supabase = createAdminClient()

    if (action === 'upsert') {
      // Create or update a company-specific override for a parameter safely without DB ON CONFLICT constraint requirements
      const { data: existing, error: findError } = await supabase
        .from('voting_parameters')
        .select('*')
        .eq('company_id', company_id)
        .eq('parameter_type', parameter_type)
        .eq('value', value)
        .maybeSingle()

      if (findError) {
        return NextResponse.json({ error: findError.message }, { status: 500 })
      }

      let data
      let error

      if (existing) {
        // If it exists, update it
        const { data: updated, error: updateError } = await supabase
          .from('voting_parameters')
          .update({
            description: description || null,
            weight: weight !== undefined ? weight : 1.0,
            ...(parameter_type === 'meeting_type' && { linked_voting_type: linked_voting_type || null })
          })
          .eq('id', existing.id)
          .select()
          .single()

        data = updated
        error = updateError
      } else {
        // If it doesn't exist, insert it
        const { data: inserted, error: insertError } = await supabase
          .from('voting_parameters')
          .insert({
            company_id,
            parameter_type,
            value,
            description: description || null,
            weight: weight !== undefined ? weight : 1.0,
            is_default: false,
            ...(parameter_type === 'meeting_type' && { linked_voting_type: linked_voting_type || null })
          })
          .select()
          .single()

        data = inserted
        error = insertError
      }

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, data })
    } else {
      // Normal insert
      const { data, error } = await supabase
        .from('voting_parameters')
        .insert({
          company_id: company_id || null,
          parameter_type,
          value,
          description: description || null,
          weight: weight !== undefined ? weight : 1.0,
          is_default: false,
          ...(parameter_type === 'meeting_type' && { linked_voting_type: linked_voting_type || null })
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, data })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, value, description, weight, linked_voting_type, parameter_type } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing parameter ID' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const updateData: any = {
      value,
      description: description || null,
      weight: weight !== undefined ? weight : 1.0,
    }

    if (parameter_type === 'meeting_type' || linked_voting_type !== undefined) {
      updateData.linked_voting_type = linked_voting_type || null
    }

    const { data, error } = await supabase
      .from('voting_parameters')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing parameter ID' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('voting_parameters')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
