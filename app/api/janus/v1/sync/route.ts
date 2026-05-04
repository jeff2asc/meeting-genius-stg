import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * JANUS Sync API (v1)
 * Uses Service Role Key (admin) to bypass RLS and return the full dataset.
 * Falls back to anon key if SUPABASE_SERVICE_ROLE_KEY is not configured.
 */
export async function GET(req: NextRequest) {
  // Using explicit service_role key as requested to bypass RLS without env files
  const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaHJsb2dxcHNlYmh1YmJhZnhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDg5MzM2MiwiZXhwIjoyMDc2NDY5MzYyfQ.e4aGlDQdBj6c82is40kz2UM684QWfV46QZBiE8GOKHg";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iehrlogqpsebhubbafxo.supabase.co";
  
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });
  
  // 1. Authorization Check (Using standardized x-api-key from docs)
  const apiKey = req.headers.get("x-api-key")
  const documentedSecret = "meeting-genius-secret-key-2026"
  
  if (!apiKey || apiKey !== documentedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // 2. Fetch all relevant data including the junction table for building assignments
    const [
      { data: companies },
      { data: buildings },
      { data: users },
      { data: userBuildings }
    ] = await Promise.all([
      supabase.from("companies").select("*"),
      supabase.from("buildings").select("*"),
      supabase.from("users").select("*"),
      supabase.from("user_buildings").select("*")
    ])

    // 3. Process Vendors (Users with user_type = 'vendor')
    const residents = users?.filter(u => u.user_type !== 'vendor') || []
    const vendors = users?.filter(u => u.user_type === 'vendor') || []

    // 4. ⭐ FETCH REAL JANUS DATA FROM DB
    let [
      { data: dbRepairs },
      { data: dbComplaints }
    ] = await Promise.all([
      supabase.from("janus_repairs").select("*").order("created_at", { ascending: false }),
      supabase.from("janus_complaints").select("*").order("created_at", { ascending: false })
    ])

    // ⭐ FALL-THROUGH: If local database is empty, pull from the Real Janus Database Directly
    if ((!dbRepairs || dbRepairs.length === 0) && (!dbComplaints || dbComplaints.length === 0)) {
      try {
        console.log("🔍 [DEBUG] Local Janus tables are empty. Connecting to Janus Database Directly...");
        
        // ⭐ Direct Connection to Janus Supabase Project
        const janusSupabaseUrl = "https://ihldyefskzluuciaudmr.supabase.co"
        const janusAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlobGR5ZWZza3psdXVjaWF1ZG1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTAwNjksImV4cCI6MjA4NzMyNjA2OX0.Fs6cvdgJSxGA5LvQhn3YK_6WPxGKwBQjf7ezM2Jl8Pc"
        
        const janusDb = createClient(janusSupabaseUrl, janusAnonKey);
        
        // Fetch from the 'tickets' table used in Janus codebase
        const { data: rawTickets, error: janusErr } = await janusDb
          .from('tickets')
          .select('*')
          .order('created_at', { ascending: false });

        if (janusErr) throw janusErr;

        if (rawTickets) {
          console.log(`✅ [DEBUG] Successfully pulled ${rawTickets.length} tickets directly from Janus DB.`);

          const mapTicket = (t: any) => ({
            id: t.id || t.ticket_id,
            building_id: t.building_id,
            building_name: t.building_name || t.building,
            title: t.subject || t.title || t.issue_type,
            priority: t.priority || t.urgency || "Medium",
            status: t.state || t.status || "Open",
            created_at: t.created_at || new Date().toISOString(),
            description: t.damage_description || t.description || t.content || ""
          });

          // ⭐ Split by the 'type' field — "repair" vs "complaint"
          const repairTickets = rawTickets.filter((t: any) => t.type === "repair");
          const complaintTickets = rawTickets.filter((t: any) => t.type === "complaint");

          dbRepairs = repairTickets.map(mapTicket);
          dbComplaints = complaintTickets.map(mapTicket);

          console.log(`🔧 [DEBUG] Split: ${dbRepairs.length} repairs, ${dbComplaints.length} complaints.`);
        }
      } catch (e) {
        console.error("❌ [DEBUG] Failed to reach Janus Database:", e);
      }
    }

    const repairs = dbRepairs || []
    const complaints = dbComplaints || []

    // 5. Transform data for Janus consumption with aliases and junction mapping
    const payload = {
      system: "Meeting Genius",
      version: "2.1",
      timestamp: new Date().toISOString(),
      counts: {
        companies: companies?.length || 0,
        buildings: buildings?.length || 0,
        residents: residents?.length || 0,
        vendors: vendors?.length || 0,
        user_buildings: userBuildings?.length || 0,
        repairs: repairs.length,
        complaints: complaints.length
      },
      data: {
        // Original names
        companies: companies || [],
        buildings: buildings || [],
        users: residents,
        vendors: vendors,
        user_buildings: userBuildings || [],
        repairs: repairs,
        complaints: complaints,
        
        // Aliases for Janus compatibility
        organizations: companies || [],
        properties: buildings || [],
        audience: residents,
        junctions: userBuildings || [] // Some systems expect 'junctions'
      }
    }

    return NextResponse.json(payload)
  } catch (error: any) {
    console.error("Critical Sync Error:", error)
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: error.message 
    }, { status: 500 })
  }
}

/**
 * Handshake endpoint for Janus to verify connection status
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    
    if (action === "handshake") {
      return NextResponse.json({ 
        status: "active", 
        message: "Meeting Genius integration portal is live.",
        capabilities: ["sync_entities", "email_notifications", "transcript_export"]
      })
    }

    if (action === "sync" || !action) {
      return NextResponse.json({ 
        success: true, 
        message: "Sync request acknowledged." 
      })
    }
    
    return NextResponse.json({ error: "Invalid action", received: action }, { status: 400 })
  } catch (err) {
    console.error("POST Sync Error:", err);
    return NextResponse.json({ error: "Bad Request" }, { status: 400 })
  }
}
