"use client"

import { useState, useEffect } from "react"
import { X, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { utcToLocalDateTime, localDateTimeToUtcIso } from "@/lib/timezone"

interface Meeting {
  id: number
  building_id: number
  title: string
  meeting_date: string
  location: string | null
  start_time: string | null
  meeting_type: string | null
  strata_plan_number: string | null
}

interface EditMeetingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  meeting: Meeting | null
}

interface Building {
  id: number
  name: string
  address: string | null
  company_id: number | null
}

export default function EditMeetingModal({
  isOpen,
  onClose,
  onSuccess,
  meeting
}: EditMeetingModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    meetingDate: "",
    location: "",
    startTime: "",
    meetingType: "",
    strataPlanNumber: "",
    buildingId: 0,
  })
  const [meetingTypes, setMeetingTypes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [availableBuildings, setAvailableBuildings] = useState<Building[]>([])
  const [loadingBuildings, setLoadingBuildings] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  const fetchAvailableBuildings = async () => {
    if (!currentUser) return

    try {
      setLoadingBuildings(true)

      let query = supabase
        .from("buildings")
        .select("id, name, address, company_id")
        .order("name")

      if (currentUser.user_type === "master" || currentUser.roles?.includes("master")) {
        // Master can see ALL buildings
      } else {
        if (currentUser.company_id) {
          query = query.eq("company_id", currentUser.company_id)
        } else {
          setAvailableBuildings([])
          setLoadingBuildings(false)
          return
        }
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error("Error fetching buildings:", fetchError)
        setError("Failed to load buildings.")
        setAvailableBuildings([])
        return
      }

      setAvailableBuildings(data || [])
    } catch (err) {
      console.error("Unexpected error fetching buildings:", err)
      setError("Unexpected error while loading buildings.")
      setAvailableBuildings([])
    } finally {
      setLoadingBuildings(false)
    }
  }

  useEffect(() => {
    async function fetchCompanyMeetingTypes() {
      if (!meeting || !meeting.building_id) {
        setMeetingTypes([
          "Council Meeting",
          "AGM",
          "SGM",
          "Special Meeting",
          "Emergency Meeting"
        ])
        setFormData(prev => ({ ...prev, meetingType: "Council Meeting" }))
        return
      }

      const { data: building, error: buildingError } = await supabase
        .from('buildings')
        .select('company_id')
        .eq('id', meeting.building_id)
        .single()

      if (buildingError || !building?.company_id) {
        setMeetingTypes([
          "Council Meeting",
          "AGM",
          "SGM",
          "Special Meeting",
          "Emergency Meeting"
        ])
        setFormData(prev => ({
          ...prev,
          meetingType: meeting?.meeting_type || "Council Meeting"
        }))
        return
      }

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('default_meeting_types')
        .eq('id', building.company_id)
        .single()

      const types = company?.default_meeting_types || [
        "Council Meeting",
        "AGM",
        "SGM",
        "Special Meeting",
        "Emergency Meeting"
      ]

      setMeetingTypes(types)
      setFormData(prev => ({
        ...prev,
        meetingType: meeting?.meeting_type || types[0] || ""
      }))
    }

    if (meeting) {
      // Convert UTC date/time to local for display in the form
      let localDate = meeting.meeting_date
      let localTime = meeting.start_time || ""

      if (meeting.meeting_date && meeting.start_time) {
        // If both date and time exist, convert from UTC to local
        const { date, time } = utcToLocalDateTime(
          meeting.meeting_date,
          meeting.start_time
        )
        localDate = date
        localTime = time
      }

      setFormData({
        title: meeting.title,
        meetingDate: localDate,
        location: meeting.location || "",
        startTime: localTime,
        meetingType: meeting.meeting_type || "",
        strataPlanNumber: meeting.strata_plan_number || "",
        buildingId: meeting.building_id,
      })

      fetchCompanyMeetingTypes()

      if (currentUser) {
        fetchAvailableBuildings()
      }
    }
  }, [meeting, currentUser])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleBuildingChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBuildingId = parseInt(e.target.value)
    setFormData(prev => ({ ...prev, buildingId: newBuildingId }))

    const { data: building, error: buildingError } = await supabase
      .from('buildings')
      .select('company_id')
      .eq('id', newBuildingId)
      .single()

    if (buildingError || !building?.company_id) {
      setMeetingTypes([
        "Council Meeting",
        "AGM",
        "SGM",
        "Special Meeting",
        "Emergency Meeting"
      ])
      return
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('default_meeting_types')
      .eq('id', building.company_id)
      .single()

    const types = company?.default_meeting_types || [
      "Council Meeting",
      "AGM",
      "SGM",
      "Special Meeting",
      "Emergency Meeting"
    ]

    setMeetingTypes(types)
    setFormData(prev => ({
      ...prev,
      meetingType: types[0] || "Council Meeting"
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!meeting) return

    setError(null)
    setSaving(true)

    try {
      // Convert local date/time back to UTC for storage
      let utcDate = formData.meetingDate
      let utcTime = formData.startTime || null

      if (formData.meetingDate && formData.startTime) {
        // Convert from local to UTC before saving
        const { date, time } = localDateTimeToUtcIso(
          formData.meetingDate,
          formData.startTime
        )
        utcDate = date
        utcTime = time
      }

      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          building_id: formData.buildingId,
          title: formData.title.trim(),
          meeting_date: utcDate,
          location: formData.location.trim() || null,
          start_time: utcTime,
          meeting_type: formData.meetingType,
          strata_plan_number: formData.strataPlanNumber.trim() || null,
        })
        .eq('id', meeting.id)

      if (updateError) {
        console.error('Error updating meeting:', updateError)
        setError('Failed to update meeting')
        setSaving(false)
        return
      }

      console.log('✅ Meeting updated successfully')

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !meeting) return null

  const currentBuilding = availableBuildings.find(b => b.id === formData.buildingId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-2xl border-0 rounded-2xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-foreground">Edit Meeting</h2>
            <p className="text-sm text-muted-foreground">
              Update meeting details (times shown in your local timezone)
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-blue-900 mb-2">
              <Building2 className="h-4 w-4" />
              Building *
            </label>
            {loadingBuildings ? (
              <p className="text-sm text-muted-foreground">Loading buildings...</p>
            ) : availableBuildings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No buildings available.</p>
            ) : (
              <>
                <select
                  name="buildingId"
                  value={formData.buildingId}
                  onChange={handleBuildingChange}
                  required
                  disabled={saving}
                  className="w-full px-3 py-2 bg-white text-foreground rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {availableBuildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                      {building.address ? ` - ${building.address}` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-blue-700 mt-2">
                  {currentUser?.user_type === "master"
                    ? "Master can select any building from any company"
                    : `Showing buildings from your company${currentUser?.company_id ? ` (ID: ${currentUser.company_id})` : ""}`}
                </p>
                {formData.buildingId !== meeting.building_id && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs text-yellow-800">
                      ⚠️ Building will be changed from original. Meeting types have been updated to match the new building's company.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Meeting Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., October 2024 Board Meeting"
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Meeting Type *
            </label>
            <select
              name="meetingType"
              value={formData.meetingType}
              onChange={handleInputChange}
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            >
              {meetingTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Meeting Date *
            </label>
            <input
              type="date"
              name="meetingDate"
              value={formData.meetingDate}
              onChange={handleInputChange}
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Start Time (Optional)
            </label>
            <input
              type="time"
              name="startTime"
              value={formData.startTime}
              onChange={handleInputChange}
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter time in your local timezone (e.g., 7:00 PM) - will be converted to UTC for storage
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Location (Optional)
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="e.g., Conference Room A or Zoom Meeting"
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Strata Plan Number (Optional)
            </label>
            <input
              type="text"
              name="strataPlanNumber"
              value={formData.strataPlanNumber}
              onChange={handleInputChange}
              placeholder="e.g., LMS1234"
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Reference number for the building/strata
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90"
              disabled={saving}
            >
              {saving ? "Updating..." : "Update Meeting"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}