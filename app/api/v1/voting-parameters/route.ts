import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getVotingParameters } from '@/lib/supabase'

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
    const companyId = searchParams.get('company_id')
    const companyIdInt = companyId ? parseInt(companyId) : null

    const data = await getVotingParameters(companyIdInt)
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}


async function checkCalculationFormulaExists(supabaseClient: any): Promise<boolean> {
  try {
    const { data } = await supabaseClient
      .from('voting_parameters')
      .select('*')
      .limit(1)
    if (data && data.length > 0) {
      return 'calculation_formula' in data[0]
    }
    return false
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, company_id, parameter_type, value, description, weight, linked_voting_type, calculation_formula, id } = body

    const supabase = createAdminClient()
    const hasFormula = await checkCalculationFormulaExists(supabase)

    if (action === 'upsert') {
      // Avoid upsert onConflict since UNIQUE constraint may not be in DB. Query first, then update or insert.
      const { data: existing, error: fetchError } = await supabase
        .from('voting_parameters')
        .select('*')
        .eq('company_id', company_id)
        .eq('parameter_type', parameter_type)
        .eq('value', value)
        .maybeSingle()

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }

      let result
      if (existing) {
        result = await supabase
          .from('voting_parameters')
          .update({
            description: description || null,
            weight: weight !== undefined ? weight : 1.0,
            ...(hasFormula && { calculation_formula: calculation_formula || null }),
            ...(parameter_type === 'meeting_type' && { linked_voting_type: linked_voting_type || null })
          })
          .eq('id', existing.id)
          .select()
          .single()
      } else {
        result = await supabase
          .from('voting_parameters')
          .insert({
            company_id,
            parameter_type,
            value,
            description: description || null,
            weight: weight !== undefined ? weight : 1.0,
            ...(hasFormula && { calculation_formula: calculation_formula || null }),
            is_default: false,
            ...(parameter_type === 'meeting_type' && { linked_voting_type: linked_voting_type || null })
          })
          .select()
          .single()
      }

      const { data, error } = result

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
          ...(hasFormula && { calculation_formula: calculation_formula || null }),
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
    const { id, value, description, weight, linked_voting_type, calculation_formula, parameter_type } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing parameter ID' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const hasFormula = await checkCalculationFormulaExists(supabase)

    const updateData: any = {
      value,
      description: description || null,
      weight: weight !== undefined ? weight : 1.0,
    }

    if (hasFormula) {
      updateData.calculation_formula = calculation_formula || null
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
