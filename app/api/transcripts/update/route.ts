import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // API Key verification
    const apiKey = request.headers.get('x-api-key');
    const validApiKey = process.env.NEXT_PUBLIC_API_KEY || ''
    if (!apiKey || apiKey !== validApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transcript_id, content, meeting_id } = await request.json();

    if (content === undefined) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    // ── "Main Transcript" — stored in meetings.meeting_transcript column ──
    if (transcript_id === 'main') {
      if (!meeting_id) {
        return NextResponse.json({ error: "Missing meeting_id for main transcript" }, { status: 400 });
      }
      const { error: updateError } = await supabase
        .from("meetings")
        .update({ meeting_transcript: content })
        .eq("id", meeting_id);

      if (updateError) throw updateError;
      return NextResponse.json({ success: true });
    }

    if (!transcript_id) {
      return NextResponse.json({ error: "Missing transcript_id" }, { status: 400 });
    }

    // Single DB update — content is stored directly in transcript_text so
    // there is no need to fetch the record first or re-upload to Storage.
    // This makes the save instant instead of waiting on two network round-trips.
    const { error: updateError } = await supabase
      .from("meeting_transcripts")
      .update({
        transcript_text: content,
        file_size: content.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transcript_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Update transcript API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
