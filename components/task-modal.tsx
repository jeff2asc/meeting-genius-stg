"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { X, Plus, Upload, Trash2, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"
import TaskEmailPreviewModal, { EmailTemplate } from "./TaskEmailPreviewModal"
import GeniusWordsInput from "./GeniusWordsInput"
import { toast } from "sonner"

interface TaskModalProps {
  topicId: number
  onClose: () => void
  onSave?: () => void
  editMode?: boolean
  existingTaskId?: number | null
  embedded?: boolean  // ⭐ NEW: For embedded mode in tabs
  isOpen?: boolean    // ⭐ NEW: For modal control
  meetingId?: string  // ⭐ NEW: Optional meetingId prop
}

interface Assignee {
  name: string
  email: string
  present?: boolean
}

interface TaskAttachment {
  id?: number
  filename: string
  file_url: string
  file_size: number
  mime_type: string
  file?: File
}

export default function TaskModal({
  topicId,
  onClose,
  onSave,
  editMode = false,
  existingTaskId = null,
  embedded = false,     // ⭐ NEW
  isOpen = true,        // ⭐ NEW
  meetingId: propMeetingId  // ⭐ NEW
}: TaskModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    dueDate: "",
    status: "open",
    sendNotification: true,
  })

  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [newAssigneeName, setNewAssigneeName] = useState("")
  const [newAssigneeEmail, setNewAssigneeEmail] = useState("")
  const [meetingAttendees, setMeetingAttendees] = useState<Assignee[]>([])
  const [meetingId, setMeetingId] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [pendingTaskData, setPendingTaskData] = useState<any>(null)

  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)

  // ⭐ NEW: Don't render if not open (for embedded mode)
  if (!isOpen && !embedded) return null

  useEffect(() => {
    if (editMode && existingTaskId) {
      loadExistingTask()
    }
  }, [editMode, existingTaskId])

  useEffect(() => {
    fetchMeetingIdAndAttendees()
  }, [topicId])

  const loadExistingTask = async () => {
    setLoading(true)
    try {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', existingTaskId)
        .single()

      if (taskError || !taskData) {
        console.error('Error loading task:', taskError)
        setError('Failed to load task')
        return
      }

      setFormData({
        description: taskData.description || "",
        dueDate: taskData.due_date || "",
        status: taskData.status || "open",
        sendNotification: false,
      })

      if (taskData.assignees && Array.isArray(taskData.assignees)) {
        setAssignees(taskData.assignees)
      }

      const { data: attachmentsData } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', existingTaskId)
        .order('created_at', { ascending: false })

      if (attachmentsData) {
        setAttachments(attachmentsData.map(att => ({
          id: att.id,
          filename: att.filename,
          file_url: att.file_url,
          file_size: att.file_size,
          mime_type: att.mime_type
        })))
      }
    } catch (err) {
      console.error('Error loading task:', err)
      setError('Failed to load task')
    } finally {
      setLoading(false)
    }
  }

  const fetchMeetingIdAndAttendees = async () => {
    try {
      console.log('🔍 Fetching meeting_id for topic:', topicId)

      const { data: topicData, error: topicError } = await supabase
        .from('topics')
        .select('meeting_id')
        .eq('id', topicId)
        .single()

      if (topicError || !topicData) {
        console.error('❌ Error fetching topic:', topicError)
        return
      }

      const fetchedMeetingId = topicData.meeting_id
      console.log('✅ Meeting ID found:', fetchedMeetingId)
      setMeetingId(fetchedMeetingId)

      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('attendees')
        .eq('id', fetchedMeetingId)
        .single()

      if (meetingError) {
        console.error('❌ Error fetching meeting attendees:', meetingError)
        return
      }

      console.log('📦 Raw attendees data:', meetingData?.attendees)

      if (meetingData?.attendees && Array.isArray(meetingData.attendees)) {
        const attendeeList = meetingData.attendees.map((a: any) => ({
          name: a.name,
          email: a.email,
          present: a.present
        }))
        console.log('✅ Meeting attendees loaded:', attendeeList)
        setMeetingAttendees(attendeeList)
      }
    } catch (err) {
      console.error('💥 Unexpected error:', err)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    const newAttachment: TaskAttachment = {
      filename: file.name,
      file_url: '',
      file_size: file.size,
      mime_type: file.type,
      file: file
    }

    setAttachments([...attachments, newAttachment])
    alert(`${file.name} added`)

    event.target.value = ''
  }

  const handleRemoveAttachment = async (index: number) => {
    const attachment = attachments[index]

    if (attachment.id && editMode) {
      try {
        const urlParts = attachment.file_url.split('/task-attachments/')
        const filePath = urlParts[1]

        const { error: storageError } = await supabase.storage
          .from('task-attachments')
          .remove([filePath])

        if (storageError) {
          console.error('Error deleting file from storage:', storageError)
        }

        const { error: dbError } = await supabase
          .from('task_attachments')
          .delete()
          .eq('id', attachment.id)

        if (dbError) {
          console.error('Error deleting attachment from DB:', dbError)
          alert('Failed to delete attachment')
          return
        }

        alert('Attachment deleted')
      } catch (err) {
        console.error('Error deleting attachment:', err)
        alert('Failed to delete attachment')
        return
      }
    }

    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileTypeBadge = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'bg-red-100 text-red-800'
    if (mimeType.includes('word') || mimeType.includes('document')) return 'bg-blue-100 text-blue-800'
    if (mimeType.includes('image')) return 'bg-purple-100 text-purple-800'
    if (mimeType.includes('text')) return 'bg-gray-100 text-gray-800'
    return 'bg-gray-100 text-gray-800'
  }

  const handleAddFromAttendees = (attendee: Assignee) => {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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

    const currentUser = getCurrentUser()

    if (editMode && existingTaskId) {
      const taskData = {
        description: formData.description.trim(),
        assignees: assignees,
        assigned_name: assignees[0].name,
        assigned_email: assignees[0].email,
        due_date: formData.dueDate || null,
        status: formData.status,
      }

      await updateTask(taskData)
    } else {
      const externalToken = crypto.randomUUID()
      const tokenExpiry = new Date()
      tokenExpiry.setDate(tokenExpiry.getDate() + 90)

      const taskData = {
        topic_id: topicId,
        description: formData.description.trim(),
        assignees: assignees,
        assigned_name: assignees[0].name,
        assigned_email: assignees[0].email,
        due_date: formData.dueDate || null,
        status: 'open',
        external_update_token: externalToken,
        token_expires_at: tokenExpiry.toISOString(),
        created_by: currentUser?.id,
        ...(typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? { created_at: new Date().toISOString() } : {})
      }

      if (formData.sendNotification) {
        setPendingTaskData({ taskData, externalToken })
        setShowEmailPreview(true)
      } else {
        await createTask(taskData, null)
      }
    }
  }

  const updateTask = async (taskData: any) => {
    setSaving(true)
    setError(null)

    try {
      console.log('💾 Updating task:', existingTaskId, taskData)

      const { error: updateError } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', existingTaskId)

      if (updateError) {
        console.error('❌ Error updating task:', updateError)
        setError(`Failed to update task: ${updateError.message}`)
        setSaving(false)
        return
      }

      console.log('✅ Task updated successfully')

      if (attachments.some(a => a.file)) {
        await uploadAttachments(existingTaskId!)
      }

      toast.success('Task updated successfully')

      onClose()

      setTimeout(() => {
        if (onSave) {
          onSave()
        }
      }, 100)
    } catch (err) {
      console.error('💥 Unexpected error:', err)
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  const createTask = async (taskData: any, emailTemplate: EmailTemplate | null) => {
    setSaving(true)
    setError(null)

    try {
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

      const taskId = data[0].id
      console.log('✅ Task saved successfully:', data)

      if (attachments.length > 0) {
        await uploadAttachments(taskId)
      }

      if (emailTemplate && meetingId) {
        await sendCustomizedEmails(emailTemplate, taskData.external_update_token)
      }

      toast.success('Task created successfully')

      // ✅ Reset state and clear form
      setSaving(false)
      setFormData({
        description: "",
        dueDate: "",
        status: "open",
        sendNotification: true,
      })
      setAssignees([])
      setAttachments([])
      setError(null)

      // ✅ If embedded mode, stay open and ready for next task
      if (embedded) {
        onClose() // Just marks data changed for when modal closes
        return
      }

      // ✅ If standalone modal, close it
      onClose()
      if (onSave) {
        setTimeout(() => onSave(), 100)
      }

    } catch (err) {
      console.error('💥 Unexpected error:', err)
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  const uploadAttachments = async (taskId: number) => {
    const currentUser = getCurrentUser()
    if (!currentUser) return

    for (const attachment of attachments) {
      if (!attachment.file) continue

      try {
        const fileName = `${taskId}/${Date.now()}_${attachment.filename}`
        const filePath = fileName

        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, attachment.file)

        if (uploadError) {
          console.error('Error uploading file:', uploadError)
          alert(`Failed to upload ${attachment.filename}`)
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(filePath)

        const { error: dbError } = await supabase
          .from('task_attachments')
          .insert({
            task_id: taskId,
            filename: attachment.filename,
            file_url: publicUrl,
            file_size: attachment.file_size,
            mime_type: attachment.mime_type,
            uploaded_by: currentUser.id
          })

        if (dbError) {
          console.error('Error saving attachment to DB:', dbError)
          alert(`Failed to save ${attachment.filename}`)
        } else {
          console.log(`✅ Uploaded ${attachment.filename}`)
        }
      } catch (err) {
        console.error('Error uploading attachment:', err)
        alert(`Failed to upload ${attachment.filename}`)
      }
    }
  }

  const sendCustomizedEmails = async (emailTemplate: EmailTemplate, externalToken: string) => {
    console.log('📧 Sending customized emails...')
    try {
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('buildings!inner(company_id)')
        .eq('id', meetingId)
        .single()

      console.log('📧 meetingData =', meetingData, 'meetingError =', meetingError)

      const companyId = (meetingData as any)?.buildings?.company_id
      console.log('📧 companyId =', companyId)

      if (!meetingError && companyId) {
        const updateLink = `${window.location.origin}/task-update/${externalToken}`

        for (const assignee of assignees) {
          console.log('📧 Sending email to', assignee.email)

          const greeting = emailTemplate.greeting.replace('{name}', assignee.name)

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">New Task Assigned</h2>
              <p>${greeting}</p>
              <p>${emailTemplate.bodyText}</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>Task:</strong> ${formData.description}
                ${formData.dueDate ? `<br><strong>Due Date:</strong> ${new Date(formData.dueDate).toLocaleDateString()}` : ''}
              </div>
              <p>You can update the task status using the link below:</p>
              <a href="${updateLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">${emailTemplate.buttonText}</a>
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">${emailTemplate.footerText}</p>
            </div>
          `

          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              to: assignee.email,
              subject: emailTemplate.subject,
              html: emailHtml
            })
          })

          const result = await response.json()

          if (response.ok) {
            console.log(`✅ Email sent to ${assignee.email}`)
          } else {
            console.error(`❌ Failed to send email to ${assignee.email}:`, result.error)
          }
        }
      } else {
        console.error('⚠️ Could not find company_id for meeting:', meetingError)
      }
    } catch (emailError) {
      console.error('⚠️ Email notification failed (task still created):', emailError)
    }
  }

  if (loading) {
    return (
      <div className={embedded ? "p-6" : "fixed inset-0 z-50 flex items-center justify-center bg-black/50"}>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Loading task...</span>
          </div>
        </Card>
      </div>
    )
  }

  // ⭐ NEW: Embedded mode content (without modal wrapper)
  const formContent = (
    <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Task Description *</label>
        <GeniusWordsInput
          value={formData.description}
          onChange={(value) => setFormData((prev) => ({ ...prev, description: value }))}
          placeholder="Enter task description... (Type # for shortcuts)"
          rows={4}
          disabled={saving}
        />
      </div>

      {editMode && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            disabled={saving}
            className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Attachments ({attachments.length})
        </label>

        <div className="mb-2">
          <label htmlFor="task-file-upload">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingFile || saving}
              className="cursor-pointer"
              onClick={() => document.getElementById('task-file-upload')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
          </label>
          <input
            id="task-file-upload"
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploadingFile || saving}
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Supported: PDF, DOC, DOCX, TXT, Images (Max 10MB)
          </p>
        </div>

        {attachments.length > 0 && (
          <div className="space-y-1.5 border border-border rounded-lg p-2 bg-muted/10">
            {attachments.map((attachment, index) => (
              <div key={index} className="flex items-center justify-between bg-background border border-border rounded-lg p-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">{attachment.filename}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${getFileTypeBadge(attachment.mime_type)}`}>
                        {attachment.mime_type.split('/')[1]?.toUpperCase() || 'FILE'}
                      </span>
                      <span>{formatFileSize(attachment.file_size)}</span>
                    </div>
                  </div>
                </div>
                {!saving && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAttachment(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Assignees *</label>

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
                      className={`w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors ${isAlreadyAssigned ? 'opacity-50 cursor-not-allowed bg-green-50' : ''
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
                No attendees added to this meeting
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

      {!editMode && (
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
      )}

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
          {saving ? (editMode ? "Updating..." : "Creating...") : (editMode ? "Update Task" : "Create Task")}
        </Button>
      </div>
    </form>
  )

  // ⭐ NEW: If embedded, return just the content without modal wrapper
  if (embedded) {
    return (
      <>
        {formContent}
        {showEmailPreview && pendingTaskData && !editMode && (
          <TaskEmailPreviewModal
            assignees={assignees}
            taskDescription={formData.description}
            dueDate={formData.dueDate}
            updateLink={`${window.location.origin}/task-update/${pendingTaskData.externalToken}`}
            onConfirm={(emailTemplate) => {
              setShowEmailPreview(false)
              createTask(pendingTaskData.taskData, emailTemplate)
            }}
            onCancel={() => {
              setShowEmailPreview(false)
              setPendingTaskData(null)
              setSaving(false)
            }}
          />
        )}
      </>
    )
  }

  // ⭐ Original modal with backdrop
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
        <Card className="w-full sm:max-w-3xl border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
            <h2 className="text-xl font-bold text-foreground">
              {editMode ? "Edit Task" : "Create Task"}
            </h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
              disabled={saving}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {formContent}
        </Card>
      </div>

      {showEmailPreview && pendingTaskData && !editMode && (
        <TaskEmailPreviewModal
          assignees={assignees}
          taskDescription={formData.description}
          dueDate={formData.dueDate}
          updateLink={`${window.location.origin}/task-update/${pendingTaskData.externalToken}`}
          onConfirm={(emailTemplate) => {
            setShowEmailPreview(false)
            createTask(pendingTaskData.taskData, emailTemplate)
          }}
          onCancel={() => {
            setShowEmailPreview(false)
            setPendingTaskData(null)
            setSaving(false)
          }}
        />
      )}
    </>
  )
}
