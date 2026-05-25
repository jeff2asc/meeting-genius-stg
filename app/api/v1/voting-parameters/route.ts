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
    const meetingTypeCount = searchParams.get('meeting_type_count')

    if (meetingTypeCount) {
      const supabase = createAdminClient()
      const companyIdParam = searchParams.get('company_id')
      const companyIdInt = companyIdParam ? parseInt(companyIdParam) : null

      let query = supabase
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .eq('meeting_type', meetingTypeCount)

      if (companyIdInt != null && !Number.isNaN(companyIdInt)) {
        const { data: buildings, error: buildingsError } = await supabase
          .from('buildings')
          .select('id')
          .eq('company_id', companyIdInt)

        if (buildingsError) {
          return NextResponse.json({ error: buildingsError.message }, { status: 500 })
        }

        const buildingIds = (buildings || []).map((b) => b.id)
        if (buildingIds.length === 0) {
          return NextResponse.json({ success: true, count: 0 })
        }
        query = query.in('building_id', buildingIds)
      }

      const { count, error } = await query
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, count: count ?? 0 })
    }

    const companyId = searchParams.get('company_id')
    const companyIdInt = companyId ? parseInt(companyId) : null

    const data = await getVotingParameters(companyIdInt)
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function cascadeMeetingTypeRename(
  supabase: ReturnType<typeof createAdminClient>,
  oldValue: string,
  newValue: string,
  companyId: number | null,
) {
  let meetingsQuery = supabase.from('meetings').update({ meeting_type: newValue }).eq('meeting_type', oldValue)

  if (companyId != null) {
    const { data: buildings, error: buildingsError } = await supabase
      .from('buildings')
      .select('id')
      .eq('company_id', companyId)

    if (buildingsError) throw buildingsError

    const buildingIds = (buildings || []).map((b) => b.id)
    if (buildingIds.length === 0) {
      return { meetingsUpdated: 0, companiesUpdated: 0 }
    }
    meetingsQuery = meetingsQuery.in('building_id', buildingIds)
  }

  const { data: updatedMeetings, error: meetingsError } = await meetingsQuery.select('id')
  if (meetingsError) throw meetingsError

  let companiesUpdated = 0
  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('id, default_meeting_types')
    .not('default_meeting_types', 'is', null)

  if (companiesError) throw companiesError

  for (const company of companies || []) {
    const types = company.default_meeting_types as string[] | null
    if (!types?.includes(oldValue)) continue
    if (companyId != null && company.id !== companyId) continue

    const updatedTypes = types.map((t) => (t === oldValue ? newValue : t))
    const { error: updateCompanyError } = await supabase
      .from('companies')
      .update({ default_meeting_types: updatedTypes })
      .eq('id', company.id)

    if (updateCompanyError) throw updateCompanyError
    companiesUpdated++
  }

  return {
    meetingsUpdated: updatedMeetings?.length ?? 0,
    companiesUpdated,
  }
}


/**
 * When a voting_type row is renamed, update the comma-separated
 * linked_voting_type strings in all meeting_type rows that reference
 * the old name. This is the app-level cascade — the DB trigger in
 * sync_voting_mechanism.sql does the same automatically once applied.
 */
async function cascadeVotingTypeRename(
  supabase: ReturnType<typeof createAdminClient>,
  oldName: string,
  newName: string,
) {
  // Fetch all meeting_type rows that contain the old name
  const { data: rows, error } = await supabase
    .from('voting_parameters')
    .select('id, linked_voting_type')
    .eq('parameter_type', 'meeting_type')
    .not('linked_voting_type', 'is', null)

  if (error || !rows || rows.length === 0) return

  for (const row of rows) {
    const parts: string[] = (row.linked_voting_type as string)
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)

    if (!parts.includes(oldName)) continue

    const updated = parts.map((p: string) => (p === oldName ? newName : p)).join(',')

    await supabase
      .from('voting_parameters')
      .update({ linked_voting_type: updated })
      .eq('id', row.id)
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

    // meeting_type and voting_type are always global — no per-company overrides.
    // user_type, building_type, decision_result can still be company-scoped.
    const effectiveCompanyId =
      (parameter_type === 'meeting_type' || parameter_type === 'voting_type')
        ? null
        : (company_id || null)

    const supabase = createAdminClient()
    const hasFormula = await checkCalculationFormulaExists(supabase)

    if (action === 'upsert') {
      const { data: existing, error: fetchError } = await supabase
        .from('voting_parameters')
        .select('*')
        .is('company_id', null)
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
            company_id: effectiveCompanyId,
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
          company_id: effectiveCompanyId,
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

    const { data: existing, error: fetchError } = await supabase
      .from('voting_parameters')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: fetchError?.message || 'Parameter not found' }, { status: 404 })
    }

    const trimmedValue = typeof value === 'string' ? value.trim() : value
    const isMeetingTypeRename =
      existing.parameter_type === 'meeting_type' &&
      typeof trimmedValue === 'string' &&
      trimmedValue.length > 0 &&
      trimmedValue !== existing.value

    if (isMeetingTypeRename) {
      let duplicateQuery = supabase
        .from('voting_parameters')
        .select('id')
        .eq('parameter_type', 'meeting_type')
        .eq('value', trimmedValue)
        .neq('id', id)

      duplicateQuery =
        existing.company_id == null
          ? duplicateQuery.is('company_id', null)
          : duplicateQuery.eq('company_id', existing.company_id)

      const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle()
      if (duplicateError) {
        return NextResponse.json({ error: duplicateError.message }, { status: 500 })
      }
      if (duplicate) {
        return NextResponse.json(
          { error: `A meeting type named "${trimmedValue}" already exists.` },
          { status: 409 },
        )
      }
    }

    const updateData: any = {
      value: trimmedValue,
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

    let cascadeResult = { meetingsUpdated: 0, companiesUpdated: 0 }
    if (isMeetingTypeRename) {
      try {
        cascadeResult = await cascadeMeetingTypeRename(
          supabase,
          existing.value,
          trimmedValue,
          existing.company_id,
        )
      } catch (cascadeErr: any) {
        await supabase
          .from('voting_parameters')
          .update({ value: existing.value })
          .eq('id', id)
        return NextResponse.json(
          {
            error: `Meeting type saved but failed to update existing meetings: ${cascadeErr.message}`,
          },
          { status: 500 },
        )
      }
    }

    // If a voting_type row was renamed, update linked_voting_type strings in all
    // meeting_type rows that reference the old name (app-level cascade — the DB
    // trigger in sync_voting_mechanism.sql handles this automatically once applied,
    // but this ensures it works even before the migration runs).
    const isVotingTypeRename =
      existing.parameter_type === 'voting_type' &&
      typeof trimmedValue === 'string' &&
      trimmedValue.length > 0 &&
      trimmedValue !== existing.value

    if (isVotingTypeRename) {
      try {
        await cascadeVotingTypeRename(supabase, existing.value, trimmedValue)
      } catch (err: any) {
        // Non-fatal — log but don't fail the request
        console.warn('[voting-parameters] linked_voting_type cascade failed:', err.message)
      }
    }

    return NextResponse.json({
      success: true,
      data,
      ...(isMeetingTypeRename && cascadeResult),
    })
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

    // Fetch the row first so we can cascade-clean linked_voting_type if it's a voting_type
    const { data: existing } = await supabase
      .from('voting_parameters')
      .select('parameter_type, value')
      .eq('id', parseInt(id))
      .maybeSingle()

    const { error } = await supabase
      .from('voting_parameters')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Remove the deleted voting type from all meeting_type linked_voting_type strings
    if (existing?.parameter_type === 'voting_type' && existing.value) {
      try {
        const { data: rows } = await supabase
          .from('voting_parameters')
          .select('id, linked_voting_type')
          .eq('parameter_type', 'meeting_type')
          .not('linked_voting_type', 'is', null)

        for (const row of rows || []) {
          const parts: string[] = (row.linked_voting_type as string)
            .split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => s && s !== existing.value)

          await supabase
            .from('voting_parameters')
            .update({ linked_voting_type: parts.length > 0 ? parts.join(',') : null })
            .eq('id', row.id)
        }
      } catch (err: any) {
        // Non-fatal
        console.warn('[voting-parameters] linked_voting_type cleanup on delete failed:', err.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
