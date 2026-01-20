import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'


// Supabase client (hardcoded credentials)
const supabaseUrl = 'https://iehrlogqpsebhubbafxo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaHJsb2dxcHNlYmh1YmJhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTMzNjIsImV4cCI6MjA3NjQ2OTM2Mn0.f00dmQAb0jNDni5hB_8seuHJwz_S3skkepmc_fIrEOk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)


// API Key validation
const VALID_API_KEY = 'meeting-genius-secret-key-2026'


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
    const {
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
      smtp_config
    } = body


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
