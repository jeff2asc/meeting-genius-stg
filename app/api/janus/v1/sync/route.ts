import { NextRequest, NextResponse } from "next/server";
import { janusClient } from "@/lib/janus-client";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const documentedSecret = "meeting-genius-secret-key-2026";

  if (apiKey !== documentedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const forceSync = req.nextUrl.searchParams.get("force") === "true";
    const companyId = req.nextUrl.searchParams.get("company_id");

    // ⭐ DIRECT FETCH from Janus DB (Bypassing HTTP middleware)
    let query = janusClient.from('tickets').select('*');
      
      if (companyId && companyId !== "undefined") {
        query = query.eq('company_id', parseInt(companyId));
      }

      const { data: rawTickets, error: janusErr } = await query.order('created_at', { ascending: false });
      
      if (janusErr) {
        console.warn("⚠️ Could not reach Janus DB:", janusErr.message);
        return NextResponse.json({ success: true, data: { repairs: [], complaints: [] }, warning: janusErr.message });
      }

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
        updated_at: t.updated_at || new Date().toISOString()
      });

      const repairs = (rawTickets || []).filter((t: any) => t.type?.toLowerCase() === 'repair').map(mapTicket);
      const complaints = (rawTickets || []).filter((t: any) => t.type?.toLowerCase() === 'complaint').map(mapTicket);

      console.log(`🔄 Syncing with Janus: ${repairs.length} repairs, ${complaints.length} complaints found.`);

      // 3. Cache locally (UPSERT)
      if (repairs.length > 0) {
        const { error: err1 } = await supabase.from("janus_repairs").upsert(repairs);
        if (err1) console.error("❌ Error upserting repairs:", err1);
      }
      if (complaints.length > 0) {
        const { error: err2 } = await supabase.from("janus_complaints").upsert(complaints);
        if (err2) console.error("❌ Error upserting complaints:", err2);
      }

      return NextResponse.json({ success: true, data: { repairs, complaints } });

  } catch (err: any) {
    console.error("Janus Sync Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
