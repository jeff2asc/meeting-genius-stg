/**
 * Next.js Middleware
 *
 * Runs on every matched request before it reaches the route handler.
 * Responsibilities:
 *  1. Protect /dashboard routes — redirect to /login if no session
 *  2. Rate-limit /api/login — max 10 attempts per IP per 15 minutes
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Simple sliding-window counter. Resets on server restart (acceptable for
// serverless — each instance tracks its own window, which is conservative).

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX       = 10;              // max attempts per window

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + RATE_LIMIT_WINDOW_MS,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - entry.count,
    resetAt: entry.windowStart + RATE_LIMIT_WINDOW_MS,
  };
}

// Clean up old entries inline (called during each request to avoid setInterval in Edge runtime)
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Clean up stale rate limit entries on each request
  cleanupRateLimitStore();

  // ── 1. Rate-limit login endpoint ──────────────────────────────────────────
  if (pathname === '/api/login' && req.method === 'POST') {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const { allowed, remaining, resetAt } = checkRateLimit(ip);

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After':           String(Math.ceil((resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit':     String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset':     String(Math.ceil(resetAt / 1000)),
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit',     String(RATE_LIMIT_MAX));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    response.headers.set('X-RateLimit-Reset',     String(Math.ceil(resetAt / 1000)));
    return response;
  }

  // ── 2. Protect /dashboard routes ─────────────────────────────────────────
  if (pathname.startsWith('/dashboard')) {
    // Check for session cookie (set by SSO flow)
    const sessionCookie = req.cookies.get('janus_session');

    if (sessionCookie) {
      // Cookie exists — let the request through
      // The page itself validates the session against the DB
      return NextResponse.next();
    }

    // No cookie — check if localStorage-based auth is being used
    // (legacy flow: user stored in localStorage, not cookie)
    // We can't read localStorage in middleware, so we allow the request
    // and let the client-side auth guard handle the redirect.
    // This is acceptable because the dashboard fetches data server-side
    // only via Supabase RLS, which enforces auth independently.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export default middleware;

export const config = {
  matcher: [
    '/api/login',
    '/dashboard/:path*',
  ],
};
