"use server"

import { apiClient } from "./api-client"
import { createAdminClient, getVotingParameters } from "./supabase"

/**
 * Server Action wrappers for the API Client.
 * These run on the server and use the INTERNAL_API_KEY for authorization.
 */

export async function fetchBuildingsAction(filters?: { company_id?: number; manager_id?: number; building_ids?: number[]; archived?: boolean }) {
  return await apiClient.v1.buildings.list(filters)
}

export async function fetchMeetingsAction(filters?: { building_id?: number; building_ids?: number[] }) {
  return await apiClient.v1.meetings.list(filters)
}

export async function fetchTasksAction(filters?: { building_id?: number; building_ids?: number[] }) {
  return await apiClient.v1.tasks.list(filters)
}

export async function deleteBuildingAction(id: number) {
  return await apiClient.v1.buildings.delete(id)
}

export async function archiveBuildingAction(id: number, archived_by?: string, archive_reason?: string) {
  return await apiClient.v1.buildings.archive(id, archived_by, archive_reason)
}

export async function unarchiveBuildingAction(id: number) {
  return await apiClient.v1.buildings.unarchive(id)
}

export async function getCompanyLogoAction(companyId: number) {
  return await apiClient.v1.companies.getLogo(companyId)
}

/**
 * Consolidates all necessary data for the Voting Tab into a single call
 * to reduce round-trips and improve performance.
 */
export async function fetchVotingTabDataAction(companyId: number | null) {
  const supabase = createAdminClient()
  
  try {
    const [parameters, rulesResult, usersResult] = await Promise.all([
      getVotingParameters(companyId),
      supabase.from("jurisdiction_rules").select("*").order("province_code").order("voting_type"),
      companyId 
        ? supabase.from("users").select("id, name, user_type, voting_weight").eq("company_id", companyId).order("name")
        : Promise.resolve({ data: [], error: null })
    ])

    if (rulesResult.error && rulesResult.error.code !== "42P01") {
      console.error("Scale Error Fetching Rules:", rulesResult.error)
    }

    if (usersResult.error) {
      console.error("Scale Error Fetching Users:", usersResult.error)
    }

    return {
      parameters: parameters || [],
      rules: rulesResult.data || [],
      users: usersResult.data || []
    }
  } catch (err) {
    console.error("Critical error in fetchVotingTabDataAction:", err)
    throw err
  }
}

export async function fetchVotingParametersAction(companyId?: number | null) {
  // Call DB directly to avoid loopback fetch issues in Server Actions
  return await getVotingParameters(companyId)
}

export async function fetchJurisdictionRulesAction(filters?: { building_type?: string; province_code?: string; voting_type?: string }) {
  const supabase = createAdminClient()
  let query = supabase.from("jurisdiction_rules").select("*").order("province_code").order("voting_type")
  
  if (filters?.building_type) query = query.eq("building_type", filters.building_type)
  if (filters?.province_code) query = query.eq("province_code", filters.province_code)
  if (filters?.voting_type) query = query.eq("voting_type", filters.voting_type)
  
  const { data, error } = await query
  if (error && error.code !== "42P01") throw error
  return data || []
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

async function cascadeVotingTypeRename(
  supabase: ReturnType<typeof createAdminClient>,
  oldName: string,
  newName: string,
) {
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

export async function saveVotingParameterAction(param: any) {
  const supabase = createAdminClient()
  
  const { data: cols } = await supabase.from('voting_parameters').select('*').limit(1)
  const hasFormula = cols && cols.length > 0 && 'calculation_formula' in cols[0]

  if (param.id) {
    const { data: existing } = await supabase.from('voting_parameters').select('*').eq('id', param.id).single()
    const { id, ...updates } = param
    const { data, error } = await supabase.from('voting_parameters').update(updates).eq('id', id).select().single()
    if (error) throw error

    let cascadeResult = { meetingsUpdated: 0, companiesUpdated: 0 }
    const trimmedValue = updates.value?.trim()

    if (existing && existing.parameter_type === 'meeting_type' && trimmedValue && trimmedValue !== existing.value) {
      cascadeResult = await cascadeMeetingTypeRename(supabase, existing.value, trimmedValue, existing.company_id)
    }

    if (existing && existing.parameter_type === 'voting_type' && trimmedValue && trimmedValue !== existing.value) {
      await cascadeVotingTypeRename(supabase, existing.value, trimmedValue)
    }

    return { data, ...cascadeResult }
  } else {
    const { data, error } = await supabase.from('voting_parameters').insert(param).select().single()
    if (error) throw error
    return { 
      data, 
      meetingsUpdated: 0, 
      companiesUpdated: 0 
    }
  }
}

export async function deleteVotingParameterAction(id: number) {
  const supabase = createAdminClient()
  const { data: existing } = await supabase.from('voting_parameters').select('parameter_type, value').eq('id', id).maybeSingle()
  const { error } = await supabase.from('voting_parameters').delete().eq('id', id)
  if (error) throw error

  if (existing?.parameter_type === 'voting_type' && existing.value) {
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
  }
}

export async function saveJurisdictionRuleAction(rule: any) {
  const supabase = createAdminClient()
  if (rule.id) {
    const { id, ...updates } = rule
    const { data, error } = await supabase.from('jurisdiction_rules').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase.from('jurisdiction_rules').insert(rule).select().single()
    if (error) throw error
    return data
  }
}

export async function deleteJurisdictionRuleAction(id: number) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('jurisdiction_rules').delete().eq('id', id)
  if (error) throw error
}

/**
 * Janus Sync Action
 * This calls the internal sync API using the server-to-server key.
 */
export async function getJanusSyncDataAction(params: { user_id: number; scope?: string; company_id?: number }) {
  const documentedSecret = process.env.INTERNAL_API_KEY || ""
  const syncParams = new URLSearchParams()
  syncParams.set("user_id", String(params.user_id))
  if (params.scope) syncParams.set("scope", params.scope)
  if (params.company_id) syncParams.set("company_id", String(params.company_id))

  // In a Server Action, window.location is not available. 
  // We use the application URL or assume relative is handled by the server runtime if needed, 
  // but better to use a reliable base (127.0.0.1 is often better than localhost in Node/Windows).
  const appUrl = (process.env.INTERNAL_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "")
  
  const res = await fetch(`${appUrl}/api/janus/v1/sync?${syncParams.toString()}`, {
    headers: { "x-api-key": documentedSecret }
  })
  
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || "Failed to fetch Janus data")
  }
  
  return await res.json()
}
