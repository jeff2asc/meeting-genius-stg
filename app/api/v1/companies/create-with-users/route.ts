import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

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
    // 1. Validate API Key
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { companyName, users }: { companyName: string; users: UserInput[] } = body

    if (!companyName?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    // 2. Create company
    const { data: newCompany, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: companyName.trim(),
        default_meeting_sections: DEFAULT_SECTIONS,
        default_meeting_types: DEFAULT_TYPES,
      })
      .select()
      .single()

    if (companyError || !newCompany) {
      console.error('Error creating company:', companyError)
      return NextResponse.json(
        { error: 'Failed to create company', details: companyError?.message },
        { status: 500 }
      )
    }

    const processedUsers: { email: string; id: number; action: 'created' | 'updated' }[] = []

    // 3. Process each user (already deduplicated by the caller)
    for (const u of users) {
      const email = u.email.toLowerCase().trim()

      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking user:', checkError)
        return NextResponse.json(
          { error: `Failed to check user: ${email}`, details: checkError.message },
          { status: 500 }
        )
      }

      if (existingUser) {
        // Update existing user — assign to new company and update roles
        const { error: updateError } = await supabase
          .from('users')
          .update({
            roles: u.roles,
            user_type: u.user_type,
            company_id: newCompany.id,
          })
          .eq('id', existingUser.id)

        if (updateError) {
          console.error('Error updating user:', updateError)
          return NextResponse.json(
            { error: `Failed to update user: ${email}`, details: updateError.message },
            { status: 500 }
          )
        }

        processedUsers.push({ email, id: existingUser.id, action: 'updated' })
      } else {
        // Hash password server-side
        const passwordHash = await bcrypt.hash(u.password.trim(), 10)

        const { data: newUser, error: insertError } = await supabase
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
          console.error('Error inserting user:', insertError)
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
    console.error('Unexpected error in create-with-users:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
