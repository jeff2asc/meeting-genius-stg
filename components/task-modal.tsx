"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"

interface TaskModalProps {
  topicId: number
  meetingId: number
  onClose: () => void
  onSave?: () => void
}

interface Assignee {
  name: string
  email: string
  present?: boolean
}

export default function TaskModal({ topicId, meetingId, onClose, onSave }: TaskModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    dueDate: "",
    sendNotification: true,
  })

  // Assignee state
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [newAssigneeName, setNewAssigneeName] = useState("")
  const [newAssigneeEmail, setNewAssigneeEmail] = useState("")
  const [meetingAttendees, setMeetingAttendees] = useState<Assignee[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // DEBUG: Log props on mount
  useEffect(() => {
    console.log('🔍 TaskModal mounted with:')
    console.log('- topicId:', topicId)
    console.log('- meetingId:', meetingId)
  }, [])

  useEffect(() => {
    if (meetingId) {
      fetchMeetingAttendees()
    } else {
      console.warn('⚠️ meetingId is undefined, cannot fetch attendees')
    }
  }, [meetingId])

  const fetchMeetingAttendees = async () => {
    try {
      console.log('📡 Fetching attendees for meeting:', meetingId)
      
      const { data, error } = await supabase
        .from("meetings")
        .select("attendees")
        .eq("id", meetingId)
        .single()

      if (error) {
        console.error('❌ Error fetching attendees:', error)
        return
      }

      console.log('📦 Raw attendees data:', data?.attendees)

      if (data?.attendees && Array.isArray(data.attendees)) {
        // Show ALL attendees, not just present ones
        const attendeeList = data.attendees.map((a: any) => ({
          name: a.name,
          email: a.email,
          present: a.present // Keep track if they were present
        }))
        console.log('✅ Meeting attendees loaded:', attendeeList)
        setMeetingAttendees(attendeeList)
      } else {
        console.warn('⚠️ No attendees array found in data')
      }
    } catch (err) {
      console.error('💥 Unexpected error fetching attendees:', err)
    }
  }

  const handleAddFromAttendees = (attendee: Assignee) => {
    // Check for duplicates
    const exists = assignees.some(a => a.email.toLowerCase() === attendee.email.toLowerCase())
    if (exists) {
      setError("This person is already assigned")
      setTimeout(() => setError(null), 3000)
      return
    }

    setAssignees([...assignees, { name: attendee.name, email: attendee.email }])
    setError(null)
  }

  const handleAddManualAssignee = () => {
    if (!newAssigneeName.trim() || !newAssigneeEmail.trim()) {
      setError("Both name and email are required")
      return
    }

    // Check for duplicates
    const exists = assignees.some(a => a.email.toLowerCase() === newAssigneeEmail.toLowerCase())
    if (exists) {
      setError("This person is already assigned")
      return
    }

    setAssignees([...assignees, { 
      name: newAssigneeName.trim(), 
      email: newAssigneeEmail.trim() 
    }])
    setNewAssigneeName("")
    setNewAssigneeEmail("")
    setError(null)
  }

  const handleRemoveAssignee = (emailToRemove: string) => {
    setAssignees(assignees.filter(a => a.email !== emailToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent, field: 'name' | 'email') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (field === 'name' && newAssigneeName.trim()) {
        document.getElementById('assignee-email-input')?.focus()
      } else if (field === 'email' && newAssigneeEmail.trim() && newAssigneeName.trim()) {
        handleAddManualAssignee()
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      sendNotification: e.target.checked,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.description.trim()) {
      setError("Task description is required")
      return
    }

    if (assignees.length === 0) {
      setError("At least one assignee is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const currentUser = getCurrentUser()

      const externalToken = crypto.randomUUID()
      const tokenExpiry = new Date()
      tokenExpiry.setDate(tokenExpiry.getDate() + 90)

      // Create ONE task with multiple assignees stored as JSONB array
      const taskData = {
        topic_id: topicId,
        description: formData.description.trim(),
        assignees: assignees, // Store all assignees as JSONB array
        assigned_name: assignees[0].name, // Keep first assignee for backward compatibility
        assigned_email: assignees[0].email, // Keep first assignee for backward compatibility
        due_date: formData.dueDate || null,
        status: 'open',
        external_update_token: externalToken,
        token_expires_at: tokenExpiry.toISOString(),
        created_by: currentUser?.id
      }

      console.log('💾 Saving task:', taskData)

      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()

      if (insertError) {
        console.error('❌ Error inserting task:', insertError)
        setError(`Failed to save task: ${insertError.message}`)
        setSaving(false)
        return
      }

      console.log('✅ Task saved successfully:', data)

      if (formData.sendNotification) {
        assignees.forEach(assignee => {
          console.log('📧 Email notification will be sent to:', assignee.email)
        })
      }

      if (onSave) {
        onSave()
      }

      onClose()
    } catch (err) {
      console.error('💥 Unexpected error:', err)
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full sm:max-w-3xl border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <h2 className="text-xl font-bold text-foreground">Create Task</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Task Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter task description..."
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none min-h-24 disabled:opacity-50"
            />
          </div>

          {/* Assignees Section */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Assignees *</label>
            
            {/* Current Assignees (Bubbles) */}
            {assignees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                {assignees.map((assignee, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm border border-blue-300"
                  >
                    <div>
                      <span className="font-medium">{assignee.name}</span>
                      <span className="text-xs opacity-75 ml-1">({assignee.email})</span>
                    </div>
                    {!saving && (
                      <button
                        onClick={() => handleRemoveAssignee(assignee.email)}
                        className="hover:bg-blue-200 rounded-full p-0.5"
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Left: Manual Add */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Add Manually</div>
                <input
                  type="text"
                  placeholder="Name"
                  value={newAssigneeName}
                  onChange={(e) => setNewAssigneeName(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, 'name')}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <input
                  id="assignee-email-input"
                  type="email"
                  placeholder="Email"
                  value={newAssigneeEmail}
                  onChange={(e) => setNewAssigneeEmail(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, 'email')}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <Button
                  type="button"
                  onClick={handleAddManualAssignee}
                  disabled={!newAssigneeName.trim() || !newAssigneeEmail.trim() || saving}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {/* Right: Select from Attendees */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">
                  Select from Attendees {meetingAttendees.length > 0 && `(${meetingAttendees.length})`}
                </div>
                {meetingAttendees.length > 0 ? (
                  <div className="border border-border rounded-lg p-2 bg-muted/20 max-h-[200px] overflow-y-auto space-y-1">
                    {meetingAttendees.map((attendee, idx) => {
                      const isAlreadyAssigned = assignees.some(a => a.email === attendee.email)
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAddFromAttendees(attendee)}
                          disabled={isAlreadyAssigned || saving}
                          className={`w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors ${
                            isAlreadyAssigned ? 'opacity-50 cursor-not-allowed bg-green-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{attendee.name}</div>
                              <div className="text-xs text-muted-foreground">{attendee.email}</div>
                            </div>
                            {attendee.present && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Present</span>
                            )}
                          </div>
                          {isAlreadyAssigned && (
                            <div className="text-xs text-green-600 font-medium mt-0.5">✓ Already assigned</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="border border-dashed border-border rounded-lg p-4 text-center text-sm text-muted-foreground">
                    {meetingId ? 'No attendees added to this meeting' : 'Meeting ID missing'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Due Date</label>
            <input
              type="date"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          {/* Send Notification Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sendNotification"
              checked={formData.sendNotification}
              onChange={handleCheckboxChange}
              disabled={saving}
              className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/50"
            />
            <label htmlFor="sendNotification" className="text-sm text-foreground">
              Send email notification to assignees
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="flex-1 bg-transparent"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90"
              disabled={saving || !formData.description.trim() || assignees.length === 0}
            >
              {saving ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
