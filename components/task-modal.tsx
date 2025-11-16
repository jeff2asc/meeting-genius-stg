"use client"

import type React from "react"

import { useState } from "react"
import { X, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"

interface TaskModalProps {
  topicId: number
  onClose: () => void
  onSave?: () => void
}

export default function TaskModal({ topicId, onClose, onSave }: TaskModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    assigneeName: "",
    assigneeEmail: "",
    dueDate: "",
    sendNotification: true,
  })

  const [fileName, setFileName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFileName(e.target.files[0].name)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('DEBUG - topicId:', topicId, 'Type:', typeof topicId)
    
    if (!formData.description.trim()) {
      setError("Task description is required")
      return
    }

    if (!formData.assigneeEmail.trim()) {
      setError("Assignee email is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const currentUser = getCurrentUser()

      const externalToken = crypto.randomUUID()
      const tokenExpiry = new Date()
      tokenExpiry.setDate(tokenExpiry.getDate() + 90)

      const insertData = {
        topic_id: topicId,
        description: formData.description.trim(),
        assigned_name: formData.assigneeName.trim() || null,
        assigned_email: formData.assigneeEmail.trim(),
        due_date: formData.dueDate || null,
        status: 'open',
        external_update_token: externalToken,
        token_expires_at: tokenExpiry.toISOString(),
        created_by: currentUser.id
      }

      console.log('Inserting task with data:', insertData)

      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert(insertData)
        .select()

      if (insertError) {
        console.error('Full error object:', JSON.stringify(insertError, null, 2))
        setError(`Failed to save task: ${insertError.message}`)
        setSaving(false)
        return
      }

      console.log('✅ Task saved successfully:', data)

      if (formData.sendNotification) {
        console.log('📧 Email notification will be sent to:', formData.assigneeEmail)
        console.log('🔗 Update token:', externalToken)
      }

      if (onSave) {
        onSave()
      }

      onClose()
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full sm:max-w-md border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl">
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

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Assignee Name</label>
            <input
              type="text"
              name="assigneeName"
              value={formData.assigneeName}
              onChange={handleInputChange}
              placeholder="Enter assignee name..."
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Assignee Email *</label>
            <input
              type="email"
              name="assigneeEmail"
              value={formData.assigneeEmail}
              onChange={handleInputChange}
              placeholder="Enter email address..."
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
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
              disabled={saving || !formData.description.trim() || !formData.assigneeEmail.trim()}
            >
              {saving ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}