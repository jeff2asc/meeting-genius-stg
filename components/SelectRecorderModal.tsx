"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X } from "lucide-react"

interface Attendee {
  name: string
  email?: string
  role?: string
  present: boolean
}

interface SelectRecorderModalProps {
  isOpen: boolean
  onClose: () => void
  attendees: Attendee[]
  initialStartTime?: string | null
  initialChairPerson?: string | null
  onConfirm: (recorderName: string, timekeeperName: string | null, startTime: string | null, chairPerson: string | null) => void
}

export default function SelectRecorderModal({
  isOpen,
  onClose,
  attendees,
  initialStartTime,
  initialChairPerson,
  onConfirm
}: SelectRecorderModalProps) {
  const [recorderName, setRecorderName] = useState<string>("")
  const [timekeeperName, setTimekeeperName] = useState<string>("")
  const [startTime, setStartTime] = useState<string>(initialStartTime || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
  const [chairPerson, setChairPerson] = useState<string>(initialChairPerson || "")
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = () => {
    if (!recorderName) {
      setError("Please select who is recording the minutes")
      return
    }

    onConfirm(recorderName, timekeeperName || null, startTime || null, chairPerson || null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Start Meeting</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Please confirm meeting details to begin.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Actual Start Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Chairperson Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Chairperson <span className="text-sm text-muted-foreground">(Optional)</span>
            </label>
            <select
              value={chairPerson}
              onChange={(e) => {
                setChairPerson(e.target.value)
                setError(null)
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">No chairperson</option>
              {attendees.map((attendee, idx) => (
                <option key={idx} value={attendee.name}>
                  {attendee.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recorder Selection (Required) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Minutes Recorder <span className="text-red-500">*</span>
            </label>
            <select
              value={recorderName}
              onChange={(e) => {
                setRecorderName(e.target.value)
                setError(null)
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select recorder...</option>
              {attendees.map((attendee, idx) => (
                <option key={idx} value={attendee.name}>
                  {attendee.name}
                </option>
              ))}
            </select>
          </div>

          {/* Timekeeper Selection (Optional) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Timekeeper <span className="text-sm text-muted-foreground">(Optional)</span>
            </label>
            <select
              value={timekeeperName}
              onChange={(e) => setTimekeeperName(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">No timekeeper</option>
              {attendees.map((attendee, idx) => (
                <option key={idx} value={attendee.name}>
                  {attendee.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            Start Meeting
          </Button>
        </div>
      </Card>
    </div>
  )
}
