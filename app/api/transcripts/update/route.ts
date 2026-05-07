import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // API Key verification
    const apiKey = request.headers.get('x-api-key');
    const validApiKey = process.env.NEXT_PUBLIC_API_KEY || 'meeting-genius-secret-key-2026';
    if (!apiKey || apiKey !== validApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transcript_id, content } = await request.json();

    if (!transcript_id || content === undefined) {
      return NextResponse.json({ error: "Missing transcript_id or content" }, { status: 400 });
    }

    // 1. Fetch current transcript record to get the file path
    const { data: transcript, error: fetchError } = await supabase
      .from("meeting_transcripts")
      .select("*")
      .eq("id", transcript_id)
      .single();

    if (fetchError || !transcript) {
      return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }

    // 2. Extract path from URL (or we could have stored it separately)
    // The URL is usually: .../meeting-transcripts/meetingId/filename
    if (!transcript.file_url) {
      return NextResponse.json({ error: "Transcript file URL missing" }, { status: 400 });
    }
    const urlParts = transcript.file_url.split('/');
    const filename = urlParts[urlParts.length - 1];
    const meetingId = transcript.meeting_id;
    const filePath = `${meetingId}/${filename}`;

    // 3. Re-upload to storage (overwriting)
    const { error: uploadError } = await supabase.storage
      .from("meeting-transcripts")
      .upload(filePath, content, {
        contentType: "text/plain",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // 4. Update file_size in DB
    const { error: updateError } = await supabase
      .from("meeting_transcripts")
      .update({ 
        file_size: content.length,
        updated_at: new Date().toISOString()
      })
      .eq("id", transcript_id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Update transcript API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
