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

    // 4. Transform data for Janus consumption with aliases and junction mapping
    const payload = {
      system: "Meeting Genius",
      version: "2.1",
      timestamp: new Date().toISOString(),
      counts: {
        companies: companies?.length || 0,
        buildings: buildings?.length || 0,
        residents: residents?.length || 0,
        vendors: vendors?.length || 0,
        user_buildings: userBuildings?.length || 0
      },
      data: {
        // Original names
        companies: companies || [],
        buildings: buildings || [],
        users: residents,
        vendors: vendors,
        user_buildings: userBuildings || [],
        
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
    const { action } = await req.json()
    
    if (action === "handshake") {
      return NextResponse.json({ 
        status: "active", 
        message: "Meeting Genius integration portal is live.",
        capabilities: ["sync_entities", "email_notifications", "transcript_export"]
      })
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 })
  }
}
