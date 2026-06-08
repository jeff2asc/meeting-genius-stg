import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

const VALID_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const buildingId = parseInt(id)
    if (isNaN(buildingId)) {
      return NextResponse.json({ error: 'Invalid Building ID' }, { status: 400 })
    }

    const body = await request.json()
    const adminClient = createAdminClient()

    const updatePayload = {
      ...body,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await adminClient
      .from('buildings')
      .update(updatePayload)
      .eq('id', buildingId)
      .select()
      .single()

    if (error) {
      console.error('Database error updating building:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, success: true })
  } catch (err: any) {
    console.error('Unexpected error in building PATCH route:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const buildingId = parseInt(id)
    if (isNaN(buildingId)) {
      return NextResponse.json({ error: 'Invalid Building ID' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Remove user-building associations first
    const { error: userBuildingsError } = await adminClient
      .from('user_buildings')
      .delete()
      .eq('building_id', buildingId)

    if (userBuildingsError) {
      console.error('Error removing user_buildings:', userBuildingsError)
      return NextResponse.json({ error: userBuildingsError.message }, { status: 500 })
    }

    // Delete the building
    const { error } = await adminClient
      .from('buildings')
      .delete()
      .eq('id', buildingId)

    if (error) {
      console.error('Database error deleting building:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Unexpected error in building DELETE route:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
