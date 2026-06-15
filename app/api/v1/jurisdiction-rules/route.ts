import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase"
function isAuthorized(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key")
  const internalKey = process.env.INTERNAL_API_KEY || ''
  return apiKey && apiKey === internalKey
}
// ─── GET: list jurisdiction rules, optionally filtered ───────────────────────
export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const buildingType = searchParams.get("building_type")
    const votingType = searchParams.get("voting_type")
    const provinceCode = searchParams.get("province_code")
    const supabase = createAdminClient()
    let query = supabase
      .from("jurisdiction_rules")
      .select("*")
      .order("province_code")
      .order("voting_type")
    if (buildingType) query = query.eq("building_type", buildingType)
    if (votingType) query = query.eq("voting_type", votingType)
    if (provinceCode) query = query.eq("province_code", provinceCode)
    const { data, error } = await query
    if (error) {
      // Table may not exist yet — return empty gracefully so UI doesn't crash
      if (error.code === "42P01") {
        return NextResponse.json({ success: true, data: [], tableNotFound: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
// ─── POST: create new jurisdiction rule ──────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json()
    const {
      province_code,
      building_type,
      voting_type,
      threshold_percent,
      abstention_treatment,
      denominator_source,
      reconsideration_trigger,
      reconsideration_threshold_percent,
      reconsideration_hold_days,
      description,
    } = body
    if (!province_code || !building_type || !voting_type || threshold_percent === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: province_code, building_type, voting_type, threshold_percent" },
        { status: 400 }
      )
    }
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("jurisdiction_rules")
      .insert({
        province_code,
        building_type,
        voting_type,
        threshold_percent,
        abstention_treatment: abstention_treatment || "exclude",
        denominator_source: denominator_source || "active",
        reconsideration_trigger: reconsideration_trigger ?? false,
        reconsideration_threshold_percent: reconsideration_threshold_percent ?? null,
        reconsideration_hold_days: reconsideration_hold_days ?? 0,
        description: description || null,
      })
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
// ─── PATCH: update jurisdiction rule by ID ───────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) {
      return NextResponse.json({ error: "Missing rule ID" }, { status: 400 })
    }
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("jurisdiction_rules")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
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
// ─── DELETE: remove jurisdiction rule by ID ──────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Missing rule ID" }, { status: 400 })
    }
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("jurisdiction_rules")
      .delete()
      .eq("id", parseInt(id))
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
