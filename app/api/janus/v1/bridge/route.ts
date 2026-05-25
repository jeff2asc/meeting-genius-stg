import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/janus/v1/bridge
 *
 * Server-side SSO bridge — called by the MG client when a user clicks
 * "Open Janus". This route calls Janus's /api/auth/sso endpoint
 * (server-to-server, so the API key is never exposed to the browser),
 * then returns the signed redirect URL back to the client.
 *
 * The client then does: window.location.href = redirect_url
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, redirect_to = "/dashboard" } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    const janusBase =
      process.env.NEXT_PUBLIC_JANUS_URL?.replace(/\/$/, "") ||
      "https://janusapp.meetinggenius.ca";

    const apiKey = process.env.NEXT_PUBLIC_API_KEY || "meeting-genius-secret-key-2026";

    // Step 1 — server-to-server: request a signed SSO token from Janus
    const ssoRes = await fetch(`${janusBase}/api/auth/sso`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ email: email.toLowerCase().trim(), redirect_to }),
    });

    if (!ssoRes.ok) {
      const errBody = await ssoRes.json().catch(() => ({}));
      console.error("[SSO Bridge] Janus rejected token request:", errBody);

      // Surface Janus-specific errors (uninstalled, user not found, etc.)
      return NextResponse.json(
        {
          error: errBody?.error || "Janus SSO request failed",
          code: errBody?.code || "sso_error",
        },
        { status: ssoRes.status }
      );
    }

    const { redirect_url, expires_in } = await ssoRes.json();

    if (!redirect_url) {
      return NextResponse.json(
        { error: "Janus did not return a redirect URL" },
        { status: 502 }
      );
    }

    // Step 2 — return the signed redirect URL to the client
    return NextResponse.json({ redirect_url, expires_in });
  } catch (err: any) {
    console.error("[SSO Bridge] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
