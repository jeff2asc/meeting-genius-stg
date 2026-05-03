import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { transcribeAudio } from "@/lib/gemini"; // ⭐ Use the new SDK-based function

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // API Key verification
    const apiKeyHeader = request.headers.get('x-api-key');
    const validApiKey = process.env.NEXT_PUBLIC_API_KEY || 'meeting-genius-secret-key-2026';
    if (!apiKeyHeader || apiKeyHeader !== validApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meeting_id, audio_url, audio_data, user_id, mime_type } = await request.json();

    if (!meeting_id || (!audio_url && !audio_data) || !user_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── Step 1: Get Audio Base64 ──────────────────────────────────────────
    let audioBase64: string;
    if (audio_data) {
      audioBase64 = audio_data;
    } else {
      const audioRes = await fetch(audio_url);
      if (!audioRes.ok) throw new Error("Failed to fetch audio from storage");
      const buffer = await audioRes.arrayBuffer();
      audioBase64 = Buffer.from(buffer).toString('base64');
    }

    // ── Step 2: Get Company LLM Settings ──────────────────────────────────
    const { data: meeting } = await supabase
      .from("meetings")
      .select("buildings(company_id)")
      .eq("id", meeting_id)
      .single();

    const companyId = (meeting as any)?.buildings?.company_id;
    const { data: company } = await supabase
      .from("companies")
      .select("llm_api_key, llm_model")
      .eq("id", companyId)
      .single();

    // ── Step 3: Call AI ──────────────────────────────────────────────────
    console.log(`🤖 Starting transcription for meeting ${meeting_id}...`);
    const transcriptText = await transcribeAudio(
      audioBase64,
      mime_type || "audio/webm",
      company?.llm_api_key || undefined,
      company?.llm_model || undefined
    );

    // ── Step 4: Save to DB ──────────────────────────────────────────────
    const filename = `transcript_${Date.now()}.txt`;
    const fileBuffer = Buffer.from(transcriptText, 'utf-8');
    
    const { error: uploadError } = await supabase.storage
      .from("meeting-recordings")
      .upload(`transcripts/${meeting_id}/${filename}`, fileBuffer, {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("meeting-recordings")
      .getPublicUrl(`transcripts/${meeting_id}/${filename}`);

    const { data: record, error: dbError } = await supabase
      .from("meeting_transcripts")
      .insert({
        meeting_id: parseInt(meeting_id),
        filename: filename,
        file_url: urlData.publicUrl
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, transcript_id: record.id });

  } catch (error: any) {
    console.error("Transcription Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
