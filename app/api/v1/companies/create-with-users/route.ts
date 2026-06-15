import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

const DEFAULT_SECTIONS = [
  "Call to Order",
  "Approval of Agenda",
  "Old Business / Business Arising",
  "New Business",
  "Financial Report",
  "Maintenance & Operations",
  "Correspondence",
  "Council Roundtable",
  "Adjournment",
]

const DEFAULT_TYPES = [
  "Council Meeting",
  "AGM",
  "SGM",
  "Special Meeting",
  "Emergency Meeting",
]

interface UserInput {
  name: string
  email: string
  password: string
  roles: string[]
  user_type: string
}

export async function POST(request: NextRequest) {
  try {
    // Use admin client for all operations — bypasses RLS entirely
    const adminClient = createAdminClient()

    // ─── Auth: accept EITHER the internal key OR a valid Supabase session ───
    const VALID_KEY = (process.env.INTERNAL_API_KEY || '').trim()
    const receivedKey = (request.headers.get('x-api-key') || '').trim()
    const authorizationHeader = request.headers.get('Authorization') || ''

    let isAuthorized = false

    // Path 1: Internal API Key (server-to-server)
    if (VALID_KEY && receivedKey === VALID_KEY) {
      isAuthorized = true
      console.log('[create-with-users] Authorized via API Key')
    }

    // Path 2: Supabase Bearer token
    if (!isAuthorized && authorizationHeader.startsWith('Bearer ')) {
      const token = authorizationHeader.replace('Bearer ', '').trim()
      const { data: { user }, error: authErr } = await adminClient.auth.getUser(token)

      if (authErr || !user) {
        console.log('[create-with-users] Bearer token invalid:', authErr?.message)
      } else {
        console.log('[create-with-users] Bearer token valid for:', user.email)
        // Look up the user's role in our users table
        const { data: dbUser } = await adminClient
          .from('users')
          .select('user_type, roles')
          .eq('email', user.email!)
          .single()

        const type = (dbUser?.user_type || '').toLowerCase()
        const roles = (dbUser?.roles || []).map((r: string) => r.toLowerCase())
        const allowed = ['master', 'corporate_administrator', 'corporate_admin', 'admin', 'property_manager']

        if (allowed.includes(type) || roles.some((r: string) => allowed.includes(r))) {
          isAuthorized = true
          console.log('[create-with-users] Authorized via session for role:', type)
        } else {
          console.log('[create-with-users] Role not authorized:', type, roles)
        }
      }
    }

    // Path 3: Skip auth entirely for localhost dev (so you can unblock yourself)
    const host = request.headers.get('host') || ''
    if (!isAuthorized && (host.startsWith('localhost') || host.startsWith('127.0.0.1'))) {
      console.log('[create-with-users] WARNING: Bypassing auth for localhost. Remove this in production!')
      isAuthorized = true
    }

    if (!isAuthorized) {
      console.log('[create-with-users] DENIED. Key match:', !!VALID_KEY && receivedKey === VALID_KEY, 'Auth header present:', !!authorizationHeader)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { companyName, users }: { companyName: string; users: UserInput[] } = body

    if (!companyName?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    // Create company using admin client
    const { data: newCompany, error: companyError } = await adminClient
      .from('companies')
      .insert({
        name: companyName.trim(),
        default_meeting_sections: DEFAULT_SECTIONS,
        default_meeting_types: DEFAULT_TYPES,
      })
      .select()
      .single()

    if (companyError || !newCompany) {
      console.error('[create-with-users] Error creating company:', companyError)
      return NextResponse.json(
        { error: 'Failed to create company', details: companyError?.message },
        { status: 500 }
      )
    }

    const processedUsers: { email: string; id: number; action: 'created' | 'updated' }[] = []

    for (const u of (users || [])) {
      const email = u.email.toLowerCase().trim()

      const { data: existingUser } = await adminClient
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existingUser) {
        await adminClient
          .from('users')
          .update({
            roles: u.roles,
            user_type: u.user_type,
            company_id: newCompany.id,
          })
          .eq('id', existingUser.id)

        processedUsers.push({ email, id: existingUser.id, action: 'updated' })
      } else {
        const passwordHash = await bcrypt.hash(u.password.trim(), 10)

        const { data: newUser, error: insertError } = await adminClient
          .from('users')
          .insert({
            name: u.name.trim(),
            email,
            password_hash: passwordHash,
            user_type: u.user_type,
            roles: u.roles,
            company_id: newCompany.id,
          })
          .select('id')
          .single()

        if (insertError || !newUser) {
          console.error('[create-with-users] Error inserting user:', insertError)
          return NextResponse.json(
            { error: `Failed to create user: ${email}`, details: insertError?.message },
            { status: 500 }
          )
        }

        processedUsers.push({ email, id: newUser.id, action: 'created' })
      }
    }

    return NextResponse.json({
      success: true,
      company: newCompany,
      users: processedUsers,
    })
  } catch (err: any) {
    console.error('[create-with-users] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
