"use client"

import { useState, useEffect } from "react"
import { Plus, Upload, Trash2, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase, getCurrentUser } from "@/lib/supabase"
import TaskEmailPreviewModal, { EmailTemplate } from "../TaskEmailPreviewModal"
import GeniusWordsInput from "../GeniusWordsInput"
import { toast } from "sonner"

interface TaskFormProps {
  topicId: number
  meetingId: number
  onSave?: () => void
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

export default function TaskForm({ topicId, meetingId, onSave }: TaskFormProps) {
  const [formData, setFormData] = useState({
    description: "",
    dueDate: "",
    sendNotification: true,
  })

  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [newAssigneeName, setNewAssigneeName] = useState("")
  const [newAssigneeEmail, setNewAssigneeEmail] = useState("")
  const [meetingAttendees, setMeetingAttendees] = useState<Assignee[]>([])
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [pendingTaskData, setPendingTaskData] = useState<any>(null)

  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)

  useEffect(() => {
    fetchMeetingAttendees()
  }, [topicId])

  const fetchMeetingAttendees = async () => {
    try {
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('attendees')
        .eq('id', meetingId)
        .single()

      if (meetingError) {
        console.error('Error fetching meeting attendees:', meetingError)
        return
      }

      if (meetingData?.attendees && Array.isArray(meetingData.attendees)) {
        const attendeeList = meetingData.attendees.map((a: any) => ({
          name: a.name,
          email: a.email,
          present: a.present
        }))
        setMeetingAttendees(attendeeList)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
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
    toast.success(`${file.name} added`)
    
    event.target.value = ''
  }

  const handleRemoveAttachment = (index: number) => {
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
          toast.error(`Failed to upload ${attachment.filename}`)
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
          toast.error(`Failed to save ${attachment.filename}`)
        } else {
          console.log(`✅ Uploaded ${attachment.filename}`)
        }
      } catch (err) {
        console.error('Error uploading attachment:', err)
        toast.error(`Failed to upload ${attachment.filename}`)
      }
    }
  }

  const createTask = async (taskData: any, emailTemplate: EmailTemplate | null) => {
    setSaving(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()

      if (insertError) {
        console.error('Error inserting task:', insertError)
        setError(`Failed to save task: ${insertError.message}`)
        setSaving(false)
        return
      }

      const taskId = data[0].id

      if (attachments.length > 0) {
        await uploadAttachments(taskId)
      }

      if (emailTemplate) {
        await sendCustomizedEmails(emailTemplate, taskData.external_update_token)
      }

      toast.success('Task created successfully')

      // ⭐ Clear form after success
      setFormData({
        description: "",
        dueDate: "",
        sendNotification: true,
      })
      setAssignees([])
      setAttachments([])
      setError(null)

      // ⭐ Trigger refresh
      if (onSave) {
        onSave()
      }

      setSaving(false)
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  const sendCustomizedEmails = async (emailTemplate: EmailTemplate, externalToken: string) => {
    try {
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('buildings!inner(company_id)')
        .eq('id', meetingId)
        .single()

      const companyId = (meetingData as any)?.buildings?.company_id

      if (!meetingError && companyId) {
        const updateLink = `${window.location.origin}/task-update/${externalToken}`

        for (const assignee of assignees) {
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

          if (response.ok) {
            console.log(`✅ Email sent to ${assignee.email}`)
          } else {
            console.error(`❌ Failed to send email to ${assignee.email}`)
          }
        }
      }
    } catch (emailError) {
      console.error('⚠️ Email notification failed:', emailError)
    }
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
      created_by: currentUser?.id
    }

    if (formData.sendNotification) {
      setPendingTaskData({ taskData, externalToken })
      setShowEmailPreview(true)
    } else {
      await createTask(taskData, null)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

        {/* Attachments Section */}
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

        {/* Assignees Section */}
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
                      <Trash2 className="h-3 w-3" />
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
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-task-green text-primary-foreground hover:opacity-90"
            disabled={saving || !formData.description.trim() || assignees.length === 0}
          >
            {saving ? "Creating..." : "Save Task"}
          </Button>
        </div>
      </form>

      {/* Email Preview Modal */}
      {showEmailPreview && pendingTaskData && (
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
