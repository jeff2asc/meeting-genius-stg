import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRequest } from '@/lib/auth-server';
import { parseMinutesToStructure } from "@/lib/ai";
import { extractTextFromFile } from "@/lib/documentExtractor";

export async function POST(request: NextRequest) {
  try {
    // API Key verification
    if (!isAuthorizedRequest(request)) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Missing required file" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "text/plain",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    let fileMimeType = file.type;
    const fileName = file.name.toLowerCase();
    if (!fileMimeType || fileMimeType === 'application/octet-stream') {
      if (fileName.endsWith('.txt')) fileMimeType = 'text/plain';
      else if (fileName.endsWith('.pdf')) fileMimeType = 'application/pdf';
      else if (fileName.endsWith('.docx')) fileMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    if (!allowedTypes.includes(fileMimeType)) {
      return NextResponse.json(
        { error: "Invalid file type. Only .txt, .pdf, and .docx are allowed" },
        { status: 400 }
      );
    }

    // Extract text from file
    let minutesText: string;
    try {
      minutesText = await extractTextFromFile(file);
    } catch (error) {
      console.error("Text extraction error:", error);
      return NextResponse.json(
        { error: "Failed to extract text from file" },
        { status: 500 }
      );
    }

    // Parse minutes structure using AI
    let parsedStructure;
    try {
      parsedStructure = await parseMinutesToStructure(minutesText);
    } catch (error: any) {
      const detail = error?.message || String(error);
      console.error("AI parsing error:", detail);
      return NextResponse.json(
        { error: "Failed to parse minutes from document", detail },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      structure: parsedStructure,
    });
  } catch (error) {
    console.error("Parse PDF API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
