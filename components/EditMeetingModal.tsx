"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

interface Meeting {
  id: number
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
    meetingType: "Council Meeting",
    strataPlanNumber: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (meeting) {
      setFormData({
        title: meeting.title,
        meetingDate: meeting.meeting_date,
        location: meeting.location || "",
        startTime: meeting.start_time || "",
        meetingType: meeting.meeting_type || "Council Meeting",
        strataPlanNumber: meeting.strata_plan_number || "",
      })
    }
  }, [meeting])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!meeting) return

    setError(null)
    setSaving(true)

    try {
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          title: formData.title.trim(),
          meeting_date: formData.meetingDate,
          location: formData.location.trim() || null,
          start_time: formData.startTime || null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-2xl border-0 rounded-2xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-foreground">Edit Meeting</h2>
            <p className="text-sm text-muted-foreground">
              Update meeting details
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
              <option value="Council Meeting">Council Meeting</option>
              <option value="AGM">AGM (Annual General Meeting)</option>
              <option value="SGM">SGM (Special General Meeting)</option>
              <option value="Special Meeting">Special Meeting</option>
              <option value="Emergency Meeting">Emergency Meeting</option>
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
              e.g., 7:00 PM
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