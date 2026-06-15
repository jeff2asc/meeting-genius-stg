import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || ''

/**
 * Validates the request authentication.
 * Supports both x-api-key (for server-to-server) and Authorization header (for frontend-to-server).
 * In development (NODE_ENV !== 'production'), all requests are automatically authorized.
 */
export async function validateRequest(req: NextRequest) {
  // 0. Development bypass — never block in dev mode
  if (process.env.NODE_ENV !== 'production') {
    return { authorized: true, user: null, method: 'dev-bypass' }
  }

  // 1. Check API Key (Server-to-Server)
  const apiKey = req.headers.get('x-api-key')
  if (apiKey) {
    if (apiKey === INTERNAL_API_KEY) {
      return { authorized: true, user: null, method: 'api-key' }
    } else {
      console.warn(`[auth] Invalid API Key: ${apiKey?.substring(0, 5)}...`)
    }
  }

  // 2. Check Authorization Header (Frontend-to-Server)
  const authHeader = req.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (user && !error) {
        return { authorized: true, user, method: 'session' }
      } else if (error) {
        console.error(`[auth] Supabase Auth Error: ${error.message}`)
      } else {
        console.warn(`[auth] No user returned for token`)
      }
    } catch (err: any) {
      console.error(`[auth] Exception in getUser: ${err.message}`)
    }
  } else if (authHeader) {
    console.warn(`[auth] Invalid Authorization Header format`)
  }

  return { authorized: false, user: null, method: 'none' }
}

/**
 * Quick inline auth check for routes that don't use validateRequest.
 * Returns true (authorized) when in development or when the API key matches.
 */
export function isAuthorizedRequest(req: NextRequest): boolean {
  // Dev bypass
  if (process.env.NODE_ENV !== 'production') return true
  
  const apiKey = (req.headers.get('x-api-key') || '').trim()
  const validKey = INTERNAL_API_KEY.trim()
  return !!(apiKey && apiKey === validKey)
}
