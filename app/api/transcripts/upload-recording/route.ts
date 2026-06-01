import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // API Key verification
    const apiKey = request.headers.get("x-api-key");
    const validApiKey = process.env.NEXT_PUBLIC_API_KEY || "";
    if (!apiKey || apiKey !== validApiKey) {
      return NextResponse.json({ error: "Unauthorized: Invalid API key" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const meetingId = formData.get("meeting_id") as string;
    const userId = formData.get("user_id") as string;
    const duration = formData.get("duration") as string;
    const browserTranscript = formData.get("browser_transcript") as string | null;

    if (!file || !meetingId) {
      return NextResponse.json(
        { error: "Missing required fields: file, meeting_id" },
        { status: 400 }
      );
    }

    // Build storage path
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${meetingId}_${timestamp}.webm`;
    const filePath = `meeting-recordings/${filename}`;

    // Upload using admin client — bypasses RLS
    const { error: uploadError } = await supabase.storage
      .from("meeting-recordings")
      .upload(filePath, file, {
        contentType: "audio/webm",
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload recording to storage", detail: uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("meeting-recordings")
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // Update the meeting record
    const updatePayload: Record<string, unknown> = {
      audio_filename: filename,
      audio_file: { url: publicUrl, path: filePath },
      audio_duration: duration ? parseInt(duration) : null,
      recording_ended_at: new Date().toISOString(),
      status: "minutes",
    };

    if (browserTranscript) {
      updatePayload.meeting_transcript = browserTranscript;
    }

    const { data: updatedMeeting, error: updateError } = await supabase
      .from("meetings")
      .update(updatePayload)
      .eq("id", parseInt(meetingId))
      .select()
      .single();

    if (updateError) {
      console.error("❌ Meeting update error:", updateError);
      return NextResponse.json(
        { error: "Recording uploaded but failed to update meeting record", detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      filename,
      file_path: filePath,
      public_url: publicUrl,
      meeting: updatedMeeting,
    });
  } catch (error: any) {
    console.error("❌ Upload recording route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
