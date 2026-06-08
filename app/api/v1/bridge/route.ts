import { NextRequest, NextResponse } from 'next/server'
import { handleOptions, withCors } from '@/lib/cors'

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, redirect_to = '/dashboard' } = body

    if (!email || typeof email !== 'string') {
      return withCors(req, NextResponse.json({ error: 'email is required' }, { status: 400 }))
    }

    const janusBase = (process.env.NEXT_PUBLIC_JANUS_URL || 'https://janusapp.meetinggenius.ca').replace(/\/$/, '')
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'meeting-genius-secret-key-2026'

    // Server-to-server: request a signed SSO token from Janus
    const ssoRes = await fetch(`${janusBase}/api/auth/sso`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ email: email.toLowerCase().trim(), redirect_to }),
    })

    if (!ssoRes.ok) {
      const errBody = await ssoRes.json().catch(() => ({}))
      console.error('[SSO Bridge] Janus rejected token request:', errBody)
      return withCors(req, NextResponse.json({
        error: errBody?.error || 'Janus SSO request failed',
        code: errBody?.code || 'sso_error',
      }, { status: ssoRes.status }))
    }

    const { redirect_url, expires_in } = await ssoRes.json()

    if (!redirect_url) {
      return withCors(req, NextResponse.json({ error: 'Janus did not return a redirect URL' }, { status: 502 }))
    }

    return withCors(req, NextResponse.json({ redirect_url, expires_in }))
  } catch (err: any) {
    console.error('[SSO Bridge] Unexpected error:', err)
    return withCors(req, NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
