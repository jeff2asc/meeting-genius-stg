import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRequest } from '@/lib/auth-server'
import { lockJanusCompany, unlockJanusCompany } from "@/lib/janus-client";
import { createAdminClient } from "@/lib/supabase";

/**
 * POST /api/v1/janus/lockout
 *
 * Server-side endpoint that locks or unlocks all Janus accounts belonging to
 * a given MG company. Called by the Integrations page on install / uninstall.
 *
 * Body:
 *   { action: "lock" | "unlock", company_id: number }
 *
 * Security:
 *   - Requires a valid x-api-key header matching INTERNAL_API_KEY
 *   - Using lockJanusCompany / unlockJanusCompany which require the Janus
 *     service-role key — never exposed to the browser
 */
export async function POST(req: NextRequest) {
  // ─── Auth: internal API key check ──────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key") || "";
  const expectedKey = process.env.INTERNAL_API_KEY || process.env.NEXT_PUBLIC_API_KEY || "";

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, company_id } = body;

    if (!action || !company_id) {
      return NextResponse.json(
        { error: "action and company_id are required" },
        { status: 400 }
      );
    }

    if (action !== "lock" && action !== "unlock") {
      return NextResponse.json(
        { error: "action must be 'lock' or 'unlock'" },
        { status: 400 }
      );
    }

    const companyId = Number(company_id);
    if (isNaN(companyId) || companyId <= 0) {
      return NextResponse.json({ error: "Invalid company_id" }, { status: 400 });
    }

    // ─── Verify the company exists in MG ─────────────────────────────────────
    const db = createAdminClient();
    const { data: company, error: companyErr } = await db
      .from("companies")
      .select("id, name, janus_integrated")
      .eq("id", companyId)
      .single();

    if (companyErr || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // ─── Execute lockout / unlock ─────────────────────────────────────────────
    if (action === "lock") {
      const { locked } = await lockJanusCompany(companyId);
      console.log(`🔒 [Lockout API] Locked ${locked} Janus users for company "${company.name}" (id=${companyId})`);
      return NextResponse.json({
        success: true,
        action: "lock",
        company_id: companyId,
        company_name: company.name,
        locked_count: locked,
        message: `${locked} Janus account(s) have been locked out for ${company.name}.`,
      });
    } else {
      const { unlocked } = await unlockJanusCompany(companyId);
      console.log(`🔓 [Lockout API] Unlocked ${unlocked} Janus users for company "${company.name}" (id=${companyId})`);
      return NextResponse.json({
        success: true,
        action: "unlock",
        company_id: companyId,
        company_name: company.name,
        unlocked_count: unlocked,
        message: `${unlocked} Janus account(s) have been re-activated for ${company.name}.`,
      });
    }
  } catch (err: any) {
    console.error("[Lockout API] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
