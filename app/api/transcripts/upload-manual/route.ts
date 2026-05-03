import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { meeting_id, content } = await request.json();

    if (!meeting_id || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`💾 [Direct Save] Saving transcript text for meeting ${meeting_id}...`);

    // 1. Save directly to the table column (Skipping Storage/Buckets entirely)
    const { error: dbError } = await supabase
      .from("meeting_transcripts")
      .insert({
        meeting_id: parseInt(meeting_id),
        transcript_text: content, // ⭐ This is the new direct column
        filename: `transcript_${Date.now()}.txt`,
        file_url: 'internal' // Placeholder since we aren't using files
      });

    if (dbError) {
      console.error("DEBUG: DB Error:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
