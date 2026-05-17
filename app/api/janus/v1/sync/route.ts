import { NextRequest, NextResponse } from "next/server";
import { janusClient } from "@/lib/janus-client";
import { createAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const documentedSecret = process.env.NEXT_PUBLIC_API_KEY || ""

  if (apiKey !== documentedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const companyId = req.nextUrl.searchParams.get("company_id");
    const db = createAdminClient(); // Bypasses RLS — can read all data

    // 1. Fetch Portfolio Data (Meeting Genius -> Janus)
    let companiesQuery = db.from("companies").select("*");
    let buildingsQuery = db.from("buildings").select("*");
    let usersQuery    = db.from("users").select("*").neq("user_type", "vendor");
    let vendorsQuery  = db.from("users").select("*").eq("user_type", "vendor");

    if (companyId && companyId !== "undefined" && companyId !== "null") {
      const cid = parseInt(companyId);
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
    } else if (companyId && companyId !== "undefined" && companyId !== "null") {
      // If no buildings found for this company, return empty junctions
      ubQuery = ubQuery.eq("building_id", -1); 
    }
    const { data: user_buildings } = await ubQuery;

    // 3. Fetch Janus Tickets (Janus -> Meeting Genius) - Direct Fetch from Janus DB
    let ticketsQuery = janusClient.from('tickets').select('*');
    if (companyId && companyId !== "undefined" && companyId !== "null") {
      const cid = parseInt(companyId);
      if (!isNaN(cid)) {
        ticketsQuery = ticketsQuery.eq('company_id', cid);
      }
    }

    const { data: rawTickets, error: janusErr } = await ticketsQuery.order('created_at', { ascending: false });
    
    let repairs: any[] = [];
    let complaints: any[] = [];
    let errors: string[] = [];

    if (janusErr) {
      console.warn("⚠️ Could not reach Janus DB:", janusErr.message);
      errors.push(`Janus DB: ${janusErr.message}`);
    } else if (rawTickets) {
      const mapTicket = (t: any) => ({
        id: Number(t.id || t.ticket_id),
        building_id: Number(t.building_id || 0),
        building_name: t.building_name || t.building || "",
        company_id: t.company_id || null,
        title: t.subject || t.title || t.issue_type || "Untitled",
        priority: t.priority || t.urgency || "Medium",
        status: t.state || t.status || "Open",
        description: t.damage_description || t.description || t.content || "",
        budget: t.budget || t.estimated_budget || null,
        estimated_cost: t.estimated_cost || t.estimated_amount || t.estimated_fixed_amount || null,
        quoted_amount: t.quoted_amount || t.quote_amount || null,
        created_at: t.created_at || new Date().toISOString(),
        updated_at: t.updated_at || new Date().toISOString(),
        type: t.type?.toLowerCase() || 'repair'
      });

      repairs = rawTickets.filter((t: any) => t.type?.toLowerCase() === 'repair').map(mapTicket);
      complaints = rawTickets.filter((t: any) => t.type?.toLowerCase() === 'complaint').map(mapTicket);

      // Cache locally (UPSERT) using admin client to bypass RLS
      if (repairs.length > 0) {
        const { error: err1 } = await db.from("janus_repairs").upsert(repairs);
        if (err1) errors.push(`Repairs Cache: ${err1.message}`);
      }
      if (complaints.length > 0) {
        const { error: err2 } = await db.from("janus_complaints").upsert(complaints);
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
