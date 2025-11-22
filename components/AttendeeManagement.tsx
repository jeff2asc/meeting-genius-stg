"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash } from "lucide-react"

// ✅ EXPORT HERE!
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
}

export default function AttendeeManagement({
  meetingId,
  attendees,
  status,
  userCanEdit,
  onUpdate
}: AttendeeManagementProps) {
  const [localAttendees, setLocalAttendees] = useState<Attendee[]>(attendees || [])

  const [newAttendee, setNewAttendee] = useState<Partial<Attendee>>({ name: "", email: "", role: "", present: false })

  // Add attendee in Working Agenda
  const handleAddAttendee = () => {
    if (!newAttendee.name) return
    setLocalAttendees([...localAttendees, { ...newAttendee, present: false } as Attendee])
    setNewAttendee({ name: "", email: "", role: "", present: false })
  }

  // Remove attendee in Working Agenda
  const handleRemoveAttendee = (index: number) => {
    const updated = [...localAttendees]
    updated.splice(index, 1)
    setLocalAttendees(updated)
  }

  // Edit fields (Working Agenda only)
  // Edit fields (Working Agenda only)
  const handleFieldChange = <K extends keyof Attendee>(
    index: number, 
    field: K, 
    value: Attendee[K]
  ) => {
    const updated: Attendee[] = [...localAttendees];
    updated[index] = { ...updated[index], [field]: value };
    setLocalAttendees(updated);
  };
  
  

  // Mark attendance in Working Minutes only
  const handlePresentChange = (index: number, checked: boolean) => {
    const updated = [...localAttendees]
    updated[index].present = checked
    setLocalAttendees(updated)
  }

  // Save all changes
  const handleSave = () => {
    onUpdate(localAttendees)
  }

  const isAgenda = status === "working_agenda"
  const isMinutes = status === "working_minutes"
  const isFinal = status === "minutes"

  return (
    <div className="mb-8 p-4 border rounded-lg bg-card shadow">
      <h3 className="font-bold text-lg mb-3">Attendees</h3>
      <table className="w-full mb-4">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left text-xs text-muted-foreground">Name</th>
            <th className="px-2 py-2 text-left text-xs text-muted-foreground">Email</th>
            <th className="px-2 py-2 text-left text-xs text-muted-foreground">Role</th>
            <th className="px-2 py-2 text-center text-xs text-muted-foreground">Present</th>
            {isAgenda && userCanEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {localAttendees.map((a, idx) => (
            <tr key={idx}>
              <td className="px-2 py-1">
                {isAgenda && userCanEdit ? (
                  <Input
                    value={a.name}
                    onChange={e => handleFieldChange(idx, "name", e.target.value)}
                    className="w-full text-sm"
                    placeholder="Full Name"
                  />
                ) : (
                  <span className="text-sm">{a.name}</span>
                )}
              </td>
              <td className="px-2 py-1">
                {isAgenda && userCanEdit ? (
                  <Input
                    value={a.email || ""}
                    onChange={e => handleFieldChange(idx, "email", e.target.value)}
                    className="w-full text-sm"
                    placeholder="Email"
                  />
                ) : (
                  <span className="text-sm">{a.email}</span>
                )}
              </td>
              <td className="px-2 py-1">
                {isAgenda && userCanEdit ? (
                  <Input
                    value={a.role || ""}
                    onChange={e => handleFieldChange(idx, "role", e.target.value)}
                    className="w-full text-sm"
                    placeholder="Role"
                  />
                ) : (
                  <span className="text-sm">{a.role}</span>
                )}
              </td>
              <td className="px-2 py-1 text-center">
                {isMinutes && userCanEdit ? (
                  <Checkbox
                    checked={a.present}
                    onCheckedChange={checked => handlePresentChange(idx, !!checked)}
                  />
                ) : (
                  <span>
                    {a.present ? "✔️" : ""}
                  </span>
                )}
              </td>
              {isAgenda && userCanEdit && (
                <td>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveAttendee(idx)}>
                    <Trash className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {isAgenda && userCanEdit && (
        <div className="flex gap-2 mb-3">
          <Input
            value={newAttendee.name || ""}
            onChange={e => setNewAttendee(n => ({ ...n, name: e.target.value }))}
            placeholder="Name"
            className="text-sm"
          />
          <Input
            value={newAttendee.email || ""}
            onChange={e => setNewAttendee(n => ({ ...n, email: e.target.value }))}
            placeholder="Email"
            className="text-sm"
          />
          <Input
            value={newAttendee.role || ""}
            onChange={e => setNewAttendee(n => ({ ...n, role: e.target.value }))}
            placeholder="Role"
            className="text-sm"
          />
          <Button onClick={handleAddAttendee} disabled={!newAttendee.name}>
            + Add
          </Button>
        </div>
      )}
      {userCanEdit && (
        <Button
          onClick={handleSave}
          className="bg-primary text-white mt-3"
          disabled={isFinal}
        >
          Save Attendees
        </Button>
      )}
    </div>
  )
}
