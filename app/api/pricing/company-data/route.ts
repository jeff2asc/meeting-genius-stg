import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Use centralized Supabase client from @/lib/supabase
// to handle hardcoded fallbacks and singletons.

// API Key validation
const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

/**
 * Calculates the billing tier based on building count
 */
function calculateTier(buildingCount: number) {
  if (buildingCount === 0) {
    return {
      tier: "Empty",
      base_price: 0,
      description: "No buildings managed yet"
    };
  } else if (buildingCount <= 5) {
    return {
      tier: "Starter",
      base_price: 99,
      range: "1-5 buildings",
      description: "Small portfolio management"
    };
  } else if (buildingCount <= 20) {
    return {
      tier: "Growth",
      base_price: 299,
      range: "6-20 buildings",
      description: "Expanding property portfolio"
    };
  } else {
    return {
      tier: "Enterprise",
      base_price: 599,
      range: "21+ buildings",
      description: "Professional multi-property management"
    };
  }
}

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

    // 8. Calculate totals and tiers
    const totalPmCount = pmList.length
    const totalAssignedBuildings = pmList.reduce((sum, pm) => sum + pm.building_count, 0)
    const totalUnassignedBuildings = unassignedBuildings.length
    const totalBuildingCount = totalAssignedBuildings + totalUnassignedBuildings
    
    // 9. Check Tiers for Odoo Billing
    const billingTier = calculateTier(totalBuildingCount)

    // 10. Build response
    return NextResponse.json({
      success: true,
      company_id: company.id,
      company_name: company.name,
      total_pm_count: totalPmCount,
      total_building_count: totalBuildingCount,
      billing_tier: billingTier,
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
