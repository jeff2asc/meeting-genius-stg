import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const documentedSecret = "meeting-genius-secret-key-2026";

  if (apiKey !== documentedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Local Supabase connection
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; 
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const forceSync = req.nextUrl.searchParams.get("force") === "true";

    // ⭐ ALWAYS fetch from Janus for now to ensure full metadata (company_id, building_name)
    // since local DB might be missing these columns.
    if (true) {
      const janusSupabaseUrl = "https://ihldyefskzluuciaudmr.supabase.co"
      const janusAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlobGR5ZWZza3psdXVjaWF1ZG1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTAwNjksImV4cCI6MjA4NzMyNjA2OX0.Fs6cvdgJSxGA5LvQhn3YK_6WPxGKwBQjf7ezM2Jl8Pc"
      const janusDb = createClient(janusSupabaseUrl, janusAnonKey);
      
      const { data: rawTickets, error: janusErr } = await janusDb.from('tickets').select('*').order('created_at', { ascending: false });
      if (janusErr) throw janusErr;

      const mapTicket = (t: any) => ({
        id: String(t.id || t.ticket_id),
        building_id: String(t.building_id || ""),
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
    }

    // Fallback if the Janus fetch block was skipped (it shouldn't be due to if(true))
    return NextResponse.json({ success: true, data: { repairs: [], complaints: [] } });

  } catch (err: any) {
    console.error("Janus Sync Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
