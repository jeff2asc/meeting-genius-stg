import { NextRequest, NextResponse } from "next/server"

// Internal Supabase URL (HTTP is fine here - server-to-server, no mixed content restriction)
const SUPABASE_INTERNAL_URL = process.env.SUPABASE_INTERNAL_URL || "http://149.5.247.118:8000"

// Headers that should NOT be forwarded to Supabase
const BLOCKED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "transfer-encoding",
  "te",
  "trailer",
  "keep-alive",
  "proxy-authorization",
  "proxy-authenticate",
  "upgrade",
  "x-supabase-auth",
])

// Headers that should NOT be forwarded back to the client
const BLOCKED_RESPONSE_HEADERS = new Set([
  "transfer-encoding",
  "connection",
  "keep-alive",
  "www-authenticate",
  "proxy-authenticate",
])

async function proxyRequest(request: NextRequest, params: { path: string[] }) {
  const path = params.path.join("/")
  const searchParams = request.nextUrl.searchParams.toString()
  const targetUrl = `${SUPABASE_INTERNAL_URL}/${path}${searchParams ? `?${searchParams}` : ""}`

  // Build forwarded headers
  const forwardedHeaders: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    if (!BLOCKED_REQUEST_HEADERS.has(key.toLowerCase())) {
      forwardedHeaders[key] = value
    }
  })

  // Handle Nginx Basic Auth conflict:
  // If the browser sent a Bearer token in 'x-supabase-auth' (from custom browser fetch), restore it as 'authorization'.
  // Otherwise, if the browser automatically attached the site's Basic Auth, delete it so it doesn't error on Supabase.
  const customAuth = request.headers.get("x-supabase-auth")
  if (customAuth) {
    forwardedHeaders["authorization"] = customAuth
  } else if (forwardedHeaders["authorization"]?.toLowerCase().startsWith("basic ")) {
    delete forwardedHeaders["authorization"]
  }

  // Ensure host header points to the internal Supabase server
  forwardedHeaders["host"] = new URL(SUPABASE_INTERNAL_URL).host

  let body: BodyInit | null = null
  const method = request.method.toUpperCase()
  if (!["GET", "HEAD"].includes(method)) {
    body = await request.arrayBuffer()
  }

  try {
    const response = await fetch(targetUrl, {
      method,
      headers: forwardedHeaders,
      body,
      // @ts-ignore - Node.js fetch option to disable automatic redirect following
      redirect: "manual",
    })

    // Build response headers
    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
      if (!BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    })

    // Allow cross-origin requests from the same app
    responseHeaders.set("Access-Control-Allow-Origin", "*")
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    responseHeaders.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, prefer, x-client-info, x-supabase-auth")

    const responseBody = await response.arrayBuffer()

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error("[supabase-proxy] Error forwarding request:", error)
    return NextResponse.json(
      { error: "Proxy error", details: String(error) },
      { status: 502 }
    )
  }
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params)
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params)
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params)
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params)
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params)
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, prefer, x-client-info, x-supabase-auth",
      "Access-Control-Max-Age": "86400",
    },
  })
}
