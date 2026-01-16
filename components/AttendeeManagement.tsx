"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash } from "lucide-react"

export interface Attendee {
  name: string
  email?: string
  role?: string
  user_id?: number
  present: boolean
}

interface AttendeeManagementProps {
  meetingId: string
  attendees: Attendee[]
  status: string
  userCanEdit: boolean
  onUpdate: (attendees: Attendee[]) => void
  onClose?: () => void
}

export default function AttendeeManagement({
  meetingId,
  attendees,
  status,
  userCanEdit,
  onUpdate,
  onClose
}: AttendeeManagementProps) {
  const [localAttendees, setLocalAttendees] = useState<Attendee[]>(attendees || [])
  const [newAttendee, setNewAttendee] = useState<Partial<Attendee>>({ name: "", email: "", role: "", present: false })

  const handleAddAttendee = () => {
    if (!newAttendee.name) return
    setLocalAttendees([...localAttendees, { ...newAttendee, present: false } as Attendee])
    setNewAttendee({ name: "", email: "", role: "", present: false })
  }

  const handleRemoveAttendee = (index: number) => {
    const updated = [...localAttendees]
    updated.splice(index, 1)
    setLocalAttendees(updated)
  }

  const handleFieldChange = <K extends keyof Attendee>(
    index: number, 
    field: K, 
    value: Attendee[K]
  ) => {
    const updated: Attendee[] = [...localAttendees]
    updated[index] = { ...updated[index], [field]: value }
    setLocalAttendees(updated)
  }

  const handlePresentChange = (index: number, checked: boolean) => {
    const updated = [...localAttendees]
    updated[index].present = checked
    setLocalAttendees(updated)
  }

  const handleSave = async () => {
    // Call onUpdate first to save the data
    await onUpdate(localAttendees)
    
    // Then close the modal/section
    if (onClose) {
      onClose()
    }
  }

  const isAgenda = status === "working_agenda"
  const isMinutes = status === "working_minutes"
  const isFinal = status === "minutes"

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Email</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Role</th>
              <th className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground w-20">Present</th>
              {isAgenda && userCanEdit && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {localAttendees.map((a, idx) => (
              <tr key={idx} className="border-b border-border/30 hover:bg-muted/10">
                <td className="px-2 py-1.5">
                  {isAgenda && userCanEdit ? (
                    <Input
                      value={a.name}
                      onChange={e => handleFieldChange(idx, "name", e.target.value)}
                      className="w-full text-xs h-7 py-1"
                      placeholder="Full Name"
                    />
                  ) : (
                    <span className="text-xs font-medium">{a.name}</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {isAgenda && userCanEdit ? (
                    <Input
                      value={a.email || ""}
                      onChange={e => handleFieldChange(idx, "email", e.target.value)}
                      className="w-full text-xs h-7 py-1"
                      placeholder="Email"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{a.email}</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {isAgenda && userCanEdit ? (
                    <Input
                      value={a.role || ""}
                      onChange={e => handleFieldChange(idx, "role", e.target.value)}
                      className="w-full text-xs h-7 py-1"
                      placeholder="Role"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{a.role}</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {isMinutes && userCanEdit ? (
                    <div className="flex justify-center">
                      <Checkbox
                        checked={a.present}
                        onCheckedChange={checked => handlePresentChange(idx, !!checked)}
                        className="h-4 w-4"
                      />
                    </div>
                  ) : (
                    <span className="text-base">{a.present ? "✓" : ""}</span>
                  )}
                </td>
                {isAgenda && userCanEdit && (
                  <td className="px-2 py-1.5">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveAttendee(idx)}
                      className="h-6 w-6"
                    >
                      <Trash className="h-3 w-3 text-red-500" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAgenda && userCanEdit && (
        <div className="flex gap-2">
          <Input
            value={newAttendee.name || ""}
            onChange={e => setNewAttendee(n => ({ ...n, name: e.target.value }))}
            placeholder="Name"
            className="text-xs h-8"
          />
          <Input
            value={newAttendee.email || ""}
            onChange={e => setNewAttendee(n => ({ ...n, email: e.target.value }))}
            placeholder="Email"
            className="text-xs h-8"
          />
          <Input
            value={newAttendee.role || ""}
            onChange={e => setNewAttendee(n => ({ ...n, role: e.target.value }))}
            placeholder="Role"
            className="text-xs h-8"
          />
          <Button onClick={handleAddAttendee} disabled={!newAttendee.name} size="sm" className="h-8">
            + Add
          </Button>
        </div>
      )}

      {userCanEdit && (
        <Button
          onClick={handleSave}
          className="bg-primary text-white w-full h-8 text-sm"
          disabled={isFinal}
        >
          Save Attendees
        </Button>
      )}
    </div>
  )
}
