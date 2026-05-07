import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------
// Add your WordPress domain(s) here so they are allowed to call
// this Next.js backend from a browser context.
// Server-side PHP calls (curl/wp_remote_get) don't need CORS,
// but having this in place covers both situations.
// ---------------------------------------------------------------
const ALLOWED_ORIGINS: string[] = [
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:8080',
  // 'https://your-wordpress-site.com',
]

export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

/** Handle browser preflight requests. Add to every API route: */
export function handleOptions(request: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) })
}

/** Stamp CORS headers onto any response before returning it. */
export function withCors(request: NextRequest, response: NextResponse): NextResponse {
  Object.entries(getCorsHeaders(request)).forEach(([k, v]) => response.headers.set(k, v))
  return response
}
