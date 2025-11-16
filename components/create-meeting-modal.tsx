"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"

interface CreateMeetingModalProps {
  onClose: () => void
  onSuccess: () => void
  buildings: Array<{ id: number; name: string }>
  selectedBuildingName?: string
}

export default function CreateMeetingModal({ onClose, onSuccess, buildings }: CreateMeetingModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    meetingDate: "",
    location: "",
    startTime: "",
    meetingType: "Council Meeting",
    strataPlanNumber: "",
    buildingId: buildings[0]?.id || 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Debug: Log buildings
  console.log("Buildings in modal:", buildings)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "buildingId" ? parseInt(value) : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const currentUser = getCurrentUser()

      // Insert the meeting
      const { data, error: insertError } = await supabase
        .from("meetings")
        .insert([
          {
            building_id: formData.buildingId,
            title: formData.title,
            meeting_date: formData.meetingDate,
            location: formData.location || null,
            start_time: formData.startTime || null,
            meeting_type: formData.meetingType,
            strata_plan_number: formData.strataPlanNumber || null,
            status: "working_agenda",
          },
        ])
        .select()

      if (insertError) {
        console.error("Error creating meeting:", insertError)
        setError(insertError.message)
        return
      }

      console.log("Meeting created successfully:", data)

      // Call onSuccess to refresh the meetings list
      onSuccess()
      onClose()
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full sm:max-w-md border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-foreground">Create New Meeting</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 border border-red-200 text-red-800 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Building Selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Building *
            </label>
            {buildings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading buildings...</p>
            ) : (
              <select
                name="buildingId"
                value={formData.buildingId}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Meeting Title */}
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
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Meeting Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Meeting Type *
            </label>
            <select
              name="meetingType"
              value={formData.meetingType}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="Council Meeting">Council Meeting</option>
              <option value="AGM">AGM (Annual General Meeting)</option>
              <option value="SGM">SGM (Special General Meeting)</option>
              <option value="Special Meeting">Special Meeting</option>
              <option value="Emergency Meeting">Emergency Meeting</option>
            </select>
          </div>

          {/* Meeting Date */}
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
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Start Time (Optional)
            </label>
            <input
              type="time"
              name="startTime"
              value={formData.startTime}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              e.g., 7:00 PM
            </p>
          </div>

          {/* Location */}
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
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Strata Plan Number */}
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
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Reference number for the building/strata
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90"
            >
              {loading ? "Creating..." : "Create Meeting"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}