import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'


// Use centralized Supabase client from @/lib/supabase
// to handle hardcoded fallbacks and singletons.


// API Key validation
const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''


export async function POST(request: NextRequest) {
  try {
    // 1. Validate API Key
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key' },
        { status: 401 }
      )
    }


    // 2. Parse request body
    const body = await request.json()
    let {
      company_name,
      corporate_admin_name,
      corporate_admin_email,
      corporate_admin_password,
      building_name,
      building_address,
      building_type,
      property_manager_name,
      property_manager_email,
      property_manager_password,
      default_meeting_sections,
      default_meeting_types,
      smtp_config,
      minutes
    } = body

    let firstMeeting = null

    if (minutes) {
      const { extractOnboardingFromMinutes } = await import('@/lib/ai')
      try {
        const extracted = await extractOnboardingFromMinutes(minutes)
        if (extracted) {
          company_name = company_name || extracted.company_name
          corporate_admin_name = corporate_admin_name || extracted.corporate_admin_name
          corporate_admin_email = corporate_admin_email || extracted.corporate_admin_email
          corporate_admin_password = corporate_admin_password || extracted.corporate_admin_password || 'MGAdmin2026!'
          building_name = building_name || extracted.building_name
          building_address = building_address || extracted.building_address
          building_type = building_type || extracted.building_type
          property_manager_name = property_manager_name || extracted.property_manager_name
          property_manager_email = property_manager_email || extracted.property_manager_email
          property_manager_password = property_manager_password || extracted.property_manager_password || 'MGAdmin2026!'
          default_meeting_sections = default_meeting_sections || extracted.default_meeting_sections
          default_meeting_types = default_meeting_types || extracted.default_meeting_types
          
          if (extracted.first_meeting) {
            firstMeeting = extracted.first_meeting
          }
        }
      } catch (err: any) {
        console.error('Failed to extract onboarding from minutes:', err)
        return NextResponse.json(
          { error: 'Failed to parse meeting minutes: ' + err.message },
          { status: 400 }
        )
      }
    }


    // 3. Validation
    if (!company_name || !corporate_admin_name || !corporate_admin_email || !corporate_admin_password) {
      return NextResponse.json(
        { error: 'Missing required fields: company_name, corporate_admin_name, corporate_admin_email, corporate_admin_password' },
        { status: 400 }
      )
    }


    // 4. Check if corporate admin email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', corporate_admin_email)
      .single()


    if (existingUser) {
      return NextResponse.json(
        { error: 'Corporate admin email already exists' },
        { status: 409 }
      )
    }


    // 5. Hash passwords
    const hashedAdminPassword = await bcrypt.hash(corporate_admin_password, 10)
    const hashedPMPassword = property_manager_password 
      ? await bcrypt.hash(property_manager_password, 10) 
      : null


    // 6. Create Company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: company_name,
        default_meeting_sections: default_meeting_sections || ['Call to Order', 'Approval of Minutes', 'Old Business', 'New Business', 'Adjournment'],
        default_meeting_types: default_meeting_types || ['Board Meeting', 'Annual General Meeting', 'Special General Meeting'],
        smtp_host: smtp_config?.host || null,
        smtp_port: smtp_config?.port || null,
        smtp_user: smtp_config?.user || null,
        smtp_password: smtp_config?.password || null,
        smtp_from_name: smtp_config?.from_name || null,
        smtp_from_email: smtp_config?.from_email || null,
        smtp_use_tls: smtp_config?.use_tls ?? true
      })
      .select()
      .single()


    if (companyError || !company) {
      console.error('Company creation error:', companyError)
      return NextResponse.json(
        { error: 'Failed to create company', details: companyError },
        { status: 500 }
      )
    }


    // 7. Create Corporate Administrator
    const { data: corporateAdmin, error: adminError } = await supabase
      .from('users')
      .insert({
        name: corporate_admin_name,
        email: corporate_admin_email,
        password_hash: hashedAdminPassword,
        user_type: 'corporate_administrator',
        company_id: company.id
      })
      .select()
      .single()


    if (adminError || !corporateAdmin) {
      console.error('Corporate admin creation error:', adminError)
      // Rollback: Delete company
      await supabase.from('companies').delete().eq('id', company.id)
      return NextResponse.json(
        { error: 'Failed to create corporate administrator', details: adminError },
        { status: 500 }
      )
    }


    // 8. Create Property Manager (if provided) - DO THIS BEFORE BUILDING
    let propertyManager = null
    if (property_manager_name && property_manager_email && hashedPMPassword) {
      const { data: pmData, error: pmError } = await supabase
        .from('users')
        .insert({
          name: property_manager_name,
          email: property_manager_email,
          password_hash: hashedPMPassword,
          user_type: 'property_manager',
          company_id: company.id
        })
        .select()
        .single()


      if (pmError) {
        console.error('Property manager creation error:', pmError)
      } else {
        propertyManager = pmData
      }
    }


    // 9. Create Building (if provided) - USE PM IF EXISTS, OTHERWISE CORPORATE ADMIN
    let building = null
    if (building_name) {
      // Use property manager as manager_id if exists, otherwise use corporate admin
      const buildingManagerId = propertyManager ? propertyManager.id : corporateAdmin.id

      const { data: buildingData, error: buildingError } = await supabase
        .from('buildings')
        .insert({
          name: building_name,
          address: building_address || null,
          building_type: building_type || 'Strata/Condo',
          company_id: company.id,
          manager_id: buildingManagerId,
          primary_color: '#3b82f6'
        })
        .select()
        .single()


      if (buildingError) {
        console.error('Building creation error:', JSON.stringify(buildingError, null, 2))
      } else {
        building = buildingData
      }
    }


    // 9.5 Create First Meeting / Agenda (if firstMeeting is provided and building exists)
    let createdMeeting = null
    if (building && firstMeeting) {
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          building_id: building.id,
          title: firstMeeting.title || 'First Meeting',
          meeting_date: firstMeeting.meeting_date || new Date().toISOString().split('T')[0],
          start_time: firstMeeting.start_time || null,
          end_time: firstMeeting.end_time || null,
          location: firstMeeting.location || null,
          meeting_type: firstMeeting.meeting_type || 'Board Meeting',
          status: 'working_agenda',
          attendees: Array.isArray(firstMeeting.attendees)
            ? firstMeeting.attendees.map((att: any) => ({
                name: att.name || 'Attendee',
                email: att.email || '',
                role: att.role || 'Attendee',
                present: false
              }))
            : []
        })
        .select()
        .single()

      if (meetingError) {
        console.error('First meeting creation error:', meetingError)
      } else if (meetingData) {
        createdMeeting = meetingData

        // Insert sections and topics
        if (Array.isArray(firstMeeting.sections)) {
          for (let sIdx = 0; sIdx < firstMeeting.sections.length; sIdx++) {
            const section = firstMeeting.sections[sIdx]
            const { data: sectionData, error: sectionError } = await supabase
              .from('sections')
              .insert({
                meeting_id: createdMeeting.id,
                title: section.title,
                order_index: sIdx + 1
              })
              .select()
              .single()

            if (sectionError) {
              console.error(`Section "${section.title}" creation error:`, sectionError)
              continue
            }

            if (sectionData && Array.isArray(section.topics)) {
              for (let tIdx = 0; tIdx < section.topics.length; tIdx++) {
                const topic = section.topics[tIdx]
                await supabase
                  .from('topics')
                  .insert({
                    meeting_id: createdMeeting.id,
                    section_id: sectionData.id,
                    title: topic.title,
                    description: topic.description || null,
                    order_index: tIdx + 1
                  })
              }
            }
          }
        }
      }
    }


    // 10. Success response
    return NextResponse.json({
      success: true,
      message: 'Signup completed successfully',
      data: {
        company: {
          id: company.id,
          name: company.name
        },
        corporate_admin: {
          id: corporateAdmin.id,
          name: corporateAdmin.name,
          email: corporateAdmin.email
        },
        building: building ? {
          id: building.id,
          name: building.name
        } : null,
        property_manager: propertyManager ? {
          id: propertyManager.id,
          name: propertyManager.name,
          email: propertyManager.email
        } : null,
        first_meeting: createdMeeting ? {
          id: createdMeeting.id,
          title: createdMeeting.title
        } : null
      }
    }, { status: 201 })


  } catch (error) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


// GET endpoint for API health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Signup API is running',
    timestamp: new Date().toISOString()
  })
}
