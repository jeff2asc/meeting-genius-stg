import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // API Key verification
    const apiKey = request.headers.get("x-api-key");
    const validApiKey = process.env.NEXT_PUBLIC_API_KEY || "";
    if (!apiKey || apiKey !== validApiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    // Try the path as-is first, then without the bucket-name prefix
    const pathsToTry = Array.from(
      new Set([filePath, filePath.replace(/^meeting-recordings\//, "")])
    );

    for (const tryPath of pathsToTry) {
      const { data, error } = await supabase.storage
        .from("meeting-recordings")
        .createSignedUrl(tryPath, 3600);

      if (data?.signedUrl && !error) {
        return NextResponse.json({ signed_url: data.signedUrl, path_used: tryPath });
      }
    }

    return NextResponse.json({ error: "Object not found in storage" }, { status: 404 });
  } catch (error: any) {
    console.error("❌ recording-url route error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
