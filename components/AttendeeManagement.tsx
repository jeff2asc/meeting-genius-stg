"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash, Send, CheckCircle, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

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
  companyId?: number | null
  onUpdate: (attendees: Attendee[]) => void
  onClose?: () => void
}

export default function AttendeeManagement({
  meetingId,
  attendees,
  status,
  userCanEdit,
  companyId,
  onUpdate,
  onClose
}: AttendeeManagementProps) {
  const [localAttendees, setLocalAttendees] = useState<Attendee[]>(attendees || [])
  const [newAttendee, setNewAttendee] = useState<Partial<Attendee>>({ name: "", email: "", role: "", present: false })
  const [sendingLink, setSendingLink] = useState<string | null>(null) // tracks which email is sending
  const [sentLinks, setSentLinks] = useState<Set<string>>(new Set())

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
    await onUpdate(localAttendees)
    if (onClose) onClose()
  }

  const handleSendLink = async (attendee: Attendee) => {
    if (!attendee.email || !companyId) return
    setSendingLink(attendee.email)

    const meetingIdNum = Number(meetingId)

    try {
      // 1. Get or generate the meeting's external token
      const { data: meetingData, error: meetingErr } = await supabase
        .from('meetings')
        .select('external_update_token, status')
        .eq('id', meetingIdNum)
        .single()

      if (meetingErr || !meetingData) {
        toast.error('Failed to fetch meeting data')
        setSendingLink(null)
        return
      }

      if (meetingData.status === 'minutes') {
        toast.error('Cannot send link — this meeting is already finalized.')
        setSendingLink(null)
        return
      }

      let token = meetingData.external_update_token

      // Generate a new token if one doesn't exist
      if (!token) {
        token = crypto.randomUUID()
        const { error: updateErr } = await supabase
          .from('meetings')
          .update({ external_update_token: token })
          .eq('id', meetingIdNum)

        if (updateErr) {
          toast.error('Failed to generate meeting link')
          setSendingLink(null)
          return
        }
      }

      // 2. Build the link
      const link = `${window.location.origin}/meeting-external/${token}`

      // 3. Send the email
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">You've been given access to view and update a meeting</h2>
          <p>Hello ${attendee.name},</p>
          <p>You can view topics, notes, tasks, and decisions for this meeting using the secure link below. You can also add new topics or edit existing ones.</p>
          <a href="${link}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Open Meeting</a>
          <p style="color: #6b7280; font-size: 13px;">This link will remain active until the meeting is finalized. Powered by Meeting Genius.</p>
        </div>
      `

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'meeting-genius-secret-key-2026'
        },
        body: JSON.stringify({
          companyId,
          to: attendee.email,
          subject: 'Meeting Genius — Your Meeting Access Link',
          html: emailHtml,
        }),
      })

      if (res.ok) {
        setSentLinks(prev => new Set(prev).add(attendee.email!))
        toast.success(`Link sent to ${attendee.email}`)
      } else {
        const result = await res.json()
        toast.error(result.error || 'Failed to send email')
      }
    } catch (err) {
      console.error('Send link error:', err)
      toast.error('Unexpected error sending link')
    } finally {
      setSendingLink(null)
    }
  }

  const isAgenda = status === "working_agenda"
  const isStarted = status === "working_minutes" || status === "minutes"
  const isMinutes = status === "working_minutes"
  const isFinal = status === "minutes"
  const canSendLink = !isFinal && !!companyId

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Email</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Role</th>
              {isStarted && <th className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground w-20">Present</th>}
              {isAgenda && userCanEdit && <th className="w-10"></th>}
              {canSendLink && <th className="w-20 text-center text-xs font-medium text-muted-foreground">Link</th>}
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
                {isStarted && (
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
                )}
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
                {canSendLink && (
                  <td className="px-2 py-1.5 text-center">
                    {a.email ? (
                      sentLinks.has(a.email) ? (
                        <span className="flex items-center justify-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle className="h-3 w-3" /> Sent
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          disabled={sendingLink === a.email}
                          onClick={() => handleSendLink(a)}
                        >
                          {sendingLink === a.email ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><Send className="h-3 w-3 mr-1" />Send</>
                          )}
                        </Button>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAgenda && userCanEdit && (
        <div className="grid grid-cols-1 sm:flex gap-2">
          <Input
            value={newAttendee.name || ""}
            onChange={e => setNewAttendee(n => ({ ...n, name: e.target.value }))}
            placeholder="Name"
            className="text-xs h-8"
          />
          <div className="grid grid-cols-2 sm:contents gap-2">
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
          </div>
          <Button onClick={handleAddAttendee} disabled={!newAttendee.name} size="sm" className="h-8 w-full sm:w-auto">
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
