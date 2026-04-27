import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { extractTasksFromTranscript } from "@/lib/ai";
import { extractTextFromFile } from "@/lib/documentExtractor";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // API Key verification
    const apiKey = request.headers.get('x-api-key');
    const validApiKey = process.env.NEXT_PUBLIC_API_KEY || 'meeting-genius-secret-key-2026';
    if (!apiKey || apiKey !== validApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key' },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const file = formData.get("file") as File;
    const meetingId = formData.get("meeting_id") as string;
    const userId = formData.get("user_id") as string;

    if (!file || !meetingId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: file, meeting_id, or user_id" },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "text/plain",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only .txt, .pdf, and .docx are allowed" },
        { status: 400 }
      );
    }

    // Upload file to Supabase Storage
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;
    const filePath = `${meetingId}/${filename}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("meeting-transcripts")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("meeting-transcripts")
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    // Extract text from file
    let transcriptText: string;
    try {
      transcriptText = await extractTextFromFile(file);
    } catch (error) {
      console.error("Text extraction error:", error);
      return NextResponse.json(
        { error: "Failed to extract text from file" },
        { status: 500 }
      );
    }

    // Get meeting sections and topics for AI analysis
    const { data: sections, error: sectionsError } = await supabase
      .from("sections")
      .select(`
        id,
        title,
        topics (
          id,
          title
        )
      `)
      .eq("meeting_id", meetingId)
      .order("order_index", { ascending: true });

    if (sectionsError) {
      console.error("Sections fetch error:", sectionsError);
      return NextResponse.json(
        { error: "Failed to fetch meeting sections" },
        { status: 500 }
      );
    }

    // Format sections for Gemini API
    const formattedSections = sections.map((section: any) => ({
      id: section.id,
      title: section.title,
      topics: Array.isArray(section.topics) ? section.topics : [],
    }));

    // Extract tasks using AI
    let extractedTasks;
    try {
      const parsedUserId = userId ? parseInt(userId) : undefined;
      // Fetch company_id for the user
      let companyId: number | undefined;
      if (parsedUserId) {
        const { data: userData } = await supabase
          .from("users")
          .select("company_id")
          .eq("id", parsedUserId)
          .single();
        if (userData?.company_id) {
          companyId = userData.company_id;
        }
      }

      extractedTasks = await extractTasksFromTranscript(
        transcriptText,
        formattedSections,
        { userId: parsedUserId, companyId: companyId }
      );
    } catch (error: any) {
      const detail = error?.message || String(error);
      console.error("AI extraction error:", detail);
      return NextResponse.json(
        { error: "Failed to extract tasks from transcript", detail },
        { status: 500 }
      );
    }

    // Save transcript record to database
    const { data: transcriptRecord, error: dbError } = await supabase
      .from("meeting_transcripts")
      .insert({
        meeting_id: parseInt(meetingId),
        filename: file.name,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type,
        parsed_json: { tasks: extractedTasks },
        tasks_created_count: 0, // Will be updated when user approves
        uploaded_by: parseInt(userId),
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Failed to save transcript record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transcript_id: transcriptRecord.id,
      extracted_tasks: extractedTasks,
      message: `Successfully extracted ${extractedTasks.length} task(s)`,
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
