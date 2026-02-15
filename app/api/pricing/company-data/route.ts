import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase client (hardcoded credentials - same as signup)
const supabaseUrl = 'https://iehrlogqpsebhubbafxo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaHJsb2dxcHNlYmh1YmJhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTMzNjIsImV4cCI6MjA3NjQ2OTM2Mn0.f00dmQAb0jNDni5hB_8seuHJwz_S3skkepmc_fIrEOk'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// API Key validation (same as signup API)
const VALID_API_KEY = 'meeting-genius-secret-key-2026'

export async function GET(request: NextRequest) {
  try {
    // 1. Validate API Key
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key' },
        { status: 401 }
      )
    }

    // 2. Get company_id from query parameters
    const { searchParams } = new URL(request.url)
    const companyIdParam = searchParams.get('company_id')

    if (!companyIdParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: company_id' },
        { status: 400 }
      )
    }

    const companyId = parseInt(companyIdParam, 10)
    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: 'Invalid company_id: must be a number' },
        { status: 400 }
      )
    }

    // 3. Fetch Company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found', details: companyError },
        { status: 404 }
      )
    }

    // 4. Fetch all Property Managers for this company
    const { data: propertyManagers, error: pmError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('company_id', companyId)
      .eq('user_type', 'property_manager')

    if (pmError) {
      console.error('Error fetching property managers:', pmError)
      return NextResponse.json(
        { error: 'Failed to fetch property managers', details: pmError },
        { status: 500 }
      )
    }

    // 5. Fetch all buildings for this company (both assigned and unassigned)
    const { data: allBuildings, error: buildingsError } = await supabase
      .from('buildings')
      .select('id, name, address, manager_id')
      .eq('company_id', companyId)

    if (buildingsError) {
      console.error('Error fetching buildings:', buildingsError)
      return NextResponse.json(
        { error: 'Failed to fetch buildings', details: buildingsError },
        { status: 500 }
      )
    }

    // 6. Organize buildings by property manager
    const pmList = (propertyManagers || []).map((pm) => {
      // Filter buildings for this PM
      const pmBuildings = (allBuildings || [])
        .filter((building) => building.manager_id === pm.id)
        .map((building) => ({
          building_id: building.id,
          building_name: building.name,
          building_address: building.address || 'N/A'
        }))

      return {
        pm_id: pm.id,
        pm_name: pm.name,
        pm_email: pm.email,
        building_count: pmBuildings.length,
        buildings: pmBuildings
      }
    })

    // 7. Get unassigned buildings (manager_id is null)
    const unassignedBuildings = (allBuildings || [])
      .filter((building) => building.manager_id === null)
      .map((building) => ({
        building_id: building.id,
        building_name: building.name,
        building_address: building.address || 'N/A'
      }))

    // 8. Calculate totals
    const totalPmCount = pmList.length
    const totalAssignedBuildings = pmList.reduce((sum, pm) => sum + pm.building_count, 0)
    const totalUnassignedBuildings = unassignedBuildings.length
    const totalBuildingCount = totalAssignedBuildings + totalUnassignedBuildings

    // 9. Build response
    return NextResponse.json({
      success: true,
      company_id: company.id,
      company_name: company.name,
      total_pm_count: totalPmCount,
      total_building_count: totalBuildingCount,
      property_managers: pmList,
      unassigned_buildings: unassignedBuildings,
      unassigned_building_count: totalUnassignedBuildings
    }, { status: 200 })

  } catch (error) {
    console.error('Pricing API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST endpoint - Get all companies list (for testing/finding company IDs)
export async function POST(request: NextRequest) {
  try {
    // Validate API Key
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key' },
        { status: 401 }
      )
    }

    // Fetch all companies with counts
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name')
      .order('id')

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch companies', details: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      total_companies: companies?.length || 0,
      companies: companies || []
    }, { status: 200 })

  } catch (error) {
    console.error('Error fetching companies:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
