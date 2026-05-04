import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = params.id;
    const supabase = createClient();

    const { data, error } = await supabase
      .from("companies")
      .select("logo_url")
      .eq("id", companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ logo_url: data.logo_url });
  } catch (error) {
    console.error("Logo fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
