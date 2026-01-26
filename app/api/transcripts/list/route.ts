import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get("meeting_id");

    if (!meetingId) {
      return NextResponse.json(
        { error: "Missing required parameter: meeting_id" },
        { status: 400 }
      );
    }

    // Fetch all transcripts for this meeting with user info
    const { data: transcripts, error } = await supabase
      .from("meeting_transcripts")
      .select(`
        *,
        users (
          name
        )
      `)
      .eq("meeting_id", parseInt(meetingId))
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching transcripts:", error);
      return NextResponse.json(
        { error: "Failed to fetch transcripts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transcripts: transcripts || [],
      count: transcripts?.length || 0,
    });
  } catch (error) {
    console.error("List transcripts API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
