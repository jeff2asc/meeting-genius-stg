import { NextRequest, NextResponse } from "next/server";
import { getJanusClient } from "@/lib/janus-client";
import { createAdminClient } from "@/lib/supabase";
import { isMaster } from "@/lib/permissions";
import { validateRequest } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  const { authorized, user: authUser } = await validateRequest(req);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const companyId = req.nextUrl.searchParams.get("company_id");
    const userId = req.nextUrl.searchParams.get("user_id");
    const db = createAdminClient(); // Bypasses RLS — can read all data

    const scopeMaster = req.nextUrl.searchParams.get("scope") === "master";
    let isMasterUser = scopeMaster;

    if (!isMasterUser && userId) {
      const uid = parseInt(userId, 10);
      if (!isNaN(uid)) {
        const { data: dbUser } = await db
          .from("users")
          .select("id, user_type, roles")
          .eq("id", uid)
          .maybeSingle();

        if (dbUser) {
          isMasterUser = isMaster(dbUser);
        }
      }
    }

    // Master accounts must never be scoped to a single company (multiple user types / company_id on record)
    const effectiveCompanyId =
      isMasterUser ? null : companyId;

    // 1. Fetch Portfolio Data (Meeting Genius -> Janus)
    let companiesQuery = db.from("companies").select("*");
    let buildingsQuery = db.from("buildings").select("*");
    let usersQuery    = db.from("users").select("*").neq("user_type", "vendor");
    let vendorsQuery  = db.from("users").select("*").eq("user_type", "vendor");

    if (!isMasterUser && effectiveCompanyId && effectiveCompanyId !== "undefined" && effectiveCompanyId !== "null") {
      const cid = parseInt(effectiveCompanyId);
      if (!isNaN(cid)) {
        companiesQuery = companiesQuery.eq("id", cid);
        buildingsQuery = buildingsQuery.eq("company_id", cid);
        usersQuery     = usersQuery.eq("company_id", cid);
        vendorsQuery   = vendorsQuery.eq("company_id", cid);
      }
    }

    const [
      { data: companies },
      { data: buildings },
      { data: users },
      { data: vendors },
    ] = await Promise.all([companiesQuery, buildingsQuery, usersQuery, vendorsQuery]);

    // 2. Fetch Junctions (user_buildings) filtered by the company's buildings
    let ubQuery = db.from("user_buildings").select("*");
    if (buildings && buildings.length > 0) {
      ubQuery = ubQuery.in("building_id", buildings.map(b => b.id));
    } else if (!isMasterUser && effectiveCompanyId && effectiveCompanyId !== "undefined" && effectiveCompanyId !== "null") {
      // If no buildings found for this company, return empty junctions
      ubQuery = ubQuery.eq("building_id", -1); 
    }
    const { data: user_buildings } = await ubQuery;

    // 3. Fetch Janus Tickets (Janus -> Meeting Genius) - Direct Fetch from Janus DB
    let repairs: any[] = [];
    let complaints: any[] = [];
    let errors: string[] = [];

    let janus: any = null;
    try {
      janus = await getJanusClient();
    } catch (janusInitErr: any) {
      console.warn("⚠️ Could not initialize Janus client:", janusInitErr.message);
      errors.push(`Janus unavailable: ${janusInitErr.message}`);
    }

    let rawTickets: any[] = [];
    let janusErr: any = null;

    if (janus) {
      let ticketsQuery = janus.from('tickets').select('*');
      if (!isMasterUser && effectiveCompanyId && effectiveCompanyId !== "undefined" && effectiveCompanyId !== "null") {
        const cid = parseInt(effectiveCompanyId);
        if (!isNaN(cid)) {
          ticketsQuery = ticketsQuery.eq('company_id', cid);
        }
      }
      try {
        const result = await ticketsQuery.order('created_at', { ascending: false });
        rawTickets = result.data || [];
        janusErr = result.error;
      } catch (fetchErr: any) {
        console.warn("⚠️ Janus ticket fetch failed:", fetchErr.message);
        errors.push(`Janus fetch: ${fetchErr.message}`);
      }
    }

    if (janusErr) {
      console.warn("⚠️ Could not reach Janus DB:", janusErr.message);
      errors.push(`Janus DB: ${janusErr.message}`);
    } else if (rawTickets.length > 0) {
      const resolveJanusTicketId = (t: any): string => {
        const candidates = [t.ticket_id, t.ticket_number, t.janus_ticket_id, t.external_id]
        for (const c of candidates) {
          if (c != null && String(c).trim()) return String(c).trim()
        }
        if (t.id != null) return `ticket-${t.id}`
        return ""
      }

      const mapTicket = (t: any) => {
        const company = (companies || []).find((c: any) => c.id === t.company_id);
        const janusTicketId = resolveJanusTicketId(t)
        return {
          id: Number(t.id),
          janus_ticket_id: janusTicketId,
          ticket_id: janusTicketId,
          building_id: Number(t.building_id || 0),
          building_name: t.building_name || t.building || "",
          company_id: t.company_id || null,
          company_name: company ? company.name : "N/A",
          title: t.subject || t.title || t.issue_type || "Untitled",
          priority: t.priority || t.urgency || "Medium",
          status: t.state || t.status || "Open",
          description: t.damage_description || t.description || t.content || "",
          budget: t.budget || t.estimated_budget || null,
          estimated_cost: t.estimated_cost || t.estimated_amount || t.estimated_fixed_amount || null,
          quoted_amount: t.quoted_amount || t.quote_amount || null,
          created_at: t.created_at || new Date().toISOString(),
          updated_at: t.updated_at || new Date().toISOString(),
          type: t.type?.toLowerCase() || 'repair',
          sender_name: t.resident_name || t.resident || t.sender_email || "Anonymous",
          unit_number: t.unit_number || t.target_unit_number || "",
          source: t.source || "Portal"
        };
      };

      repairs = rawTickets.filter((t: any) => t.type?.toLowerCase() === 'repair').map(mapTicket);
      complaints = rawTickets.filter((t: any) => t.type?.toLowerCase() === 'complaint').map(mapTicket);

      const toDbRow = (ticket: any) => ({
        id: ticket.id,
        janus_ticket_id: ticket.janus_ticket_id,
        building_id: ticket.building_id,
        title: ticket.title,
        priority: ticket.priority,
        status: ticket.status,
        budget: ticket.budget,
        estimated_cost: ticket.estimated_cost,
        quoted_amount: ticket.quoted_amount,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        building_name: ticket.building_name,
        company_id: ticket.company_id,
        description: ticket.description
      });

      // Cache locally (UPSERT) using admin client to bypass RLS
      if (repairs.length > 0) {
        const { error: err1 } = await db.from("janus_repairs").upsert(repairs.map(toDbRow));
        if (err1) errors.push(`Repairs Cache: ${err1.message}`);
      }
      if (complaints.length > 0) {
        const { error: err2 } = await db.from("janus_complaints").upsert(complaints.map(toDbRow));
        if (err2) errors.push(`Complaints Cache: ${err2.message}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        companies: companies || [],
        buildings: buildings || [],
        users: users || [],
        vendors: vendors || [],
        user_buildings: user_buildings || [],
        repairs, 
        complaints 
      },
      errors: errors.length > 0 ? errors : undefined 
    });

  } catch (err: any) {
    console.error("Janus Sync Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
