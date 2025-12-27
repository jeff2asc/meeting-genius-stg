"use client"

import { useState, useEffect } from "react"
import { X, Plus, User, Calendar, CheckCircle, Clock, FileText, Edit2, Paperclip, Download, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser, TaskAttachment } from "@/lib/supabase"
import { toast } from "sonner"

interface TaskDetailsModalProps {
  taskId: number
  onClose: () => void
  onUpdate?: () => void
}

interface Assignee {
  name: string
  email: string
}

interface TaskNote {
  id: number
  content: string
  created_at: string
  created_by: number
  creator_name?: string
}

interface TaskData {
  id: number
  description: string
  assignees: Assignee[]
  assigned_name: string
  assigned_email: string
  status: string
  due_date: string | null
  created_at: string
  created_by: number
  creator_name?: string
}

export default function TaskDetailsModal({ taskId, onClose, onUpdate }: TaskDetailsModalProps) {
  const [task, setTask] = useState<TaskData | null>(null)
  const [notes, setNotes] = useState<TaskNote[]>([])
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [newNote, setNewNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingNote, setSavingNote] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState("")

  const currentUser = getCurrentUser()

  const statusOptions = [
    { value: "open", label: "Open", color: "bg-blue-100 text-blue-800" },
    { value: "in_progress", label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
    { value: "completed", label: "Completed", color: "bg-green-100 text-green-800" },
    { value: "blocked", label: "Blocked", color: "bg-red-100 text-red-800" },
  ]

  useEffect(() => {
    fetchTaskDetails()
    fetchTaskNotes()
    fetchTaskAttachments()
  }, [taskId])

  const fetchTaskDetails = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          creator:created_by(name)
        `)
        .eq('id', taskId)
        .single()

      if (error) {
        console.error('Error fetching task:', error)
        return
      }

      console.log('Task data:', data)
      setTask({
        ...data,
        creator_name: data.creator?.name || 'Unknown'
      })
      setSelectedStatus(data.status || 'open')
    } catch (err) {
      console.error('Unexpected error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTaskNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('task_notes')
        .select(`
          *,
          creator:created_by(name)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching notes:', error)
        return
      }

      setNotes(data.map(note => ({
        ...note,
        creator_name: note.creator?.name || 'Unknown'
      })))
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  // ⭐ NEW: Fetch task attachments
  const fetchTaskAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching attachments:', error)
        return
      }

      setAttachments(data || [])
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return

    setSavingNote(true)
    try {
      const { error } = await supabase
        .from('task_notes')
        .insert({
          task_id: taskId,
          content: newNote.trim(),
          created_by: currentUser?.id
        })

      if (error) {
        console.error('Error adding note:', error)
        toast.error('Failed to add note')
        return
      }

      setNewNote("")
      await fetchTaskNotes()
      toast.success('Note added successfully')
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Failed to add note')
    } finally {
      setSavingNote(false)
    }
  }

  // ⭐ NEW: Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setUploadingFile(true)
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${file.name}`
      const filePath = `${taskId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        toast.error('Failed to upload file')
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath)

      // Save to database
      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          filename: file.name,
          file_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: currentUser?.id
        })

      if (dbError) {
        console.error('Error saving attachment:', dbError)
        toast.error('Failed to save attachment')
        return
      }

      toast.success('File uploaded successfully')
      await fetchTaskAttachments()
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Failed to upload file')
    } finally {
      setUploadingFile(false)
      // Reset file input
      event.target.value = ''
    }
  }

  // ⭐ NEW: Handle file deletion
  const handleDeleteAttachment = async (attachment: TaskAttachment) => {
    if (!confirm(`Delete ${attachment.filename}?`)) return

    try {
      // Extract file path from URL
      const urlParts = attachment.file_url.split('/task-attachments/')
      const filePath = urlParts[1]

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('task-attachments')
        .remove([filePath])

      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachment.id)

      if (dbError) {
        console.error('Error deleting attachment:', dbError)
        toast.error('Failed to delete attachment')
        return
      }

      toast.success('Attachment deleted')
      await fetchTaskAttachments()
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Failed to delete attachment')
    }
  }

  // ⭐ NEW: Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // ⭐ NEW: Get file type badge color
  const getFileTypeBadge = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'bg-red-100 text-red-800'
    if (mimeType.includes('word') || mimeType.includes('document')) return 'bg-blue-100 text-blue-800'
    if (mimeType.includes('image')) return 'bg-purple-100 text-purple-800'
    if (mimeType.includes('text')) return 'bg-gray-100 text-gray-800'
    return 'bg-gray-100 text-gray-800'
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)

      if (error) {
        console.error('Error updating status:', error)
        toast.error('Failed to update status')
        return
      }

      setSelectedStatus(newStatus)
      setIsEditingStatus(false)
      await fetchTaskDetails()
      toast.success('Status updated')
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Failed to update status')
    }
  }

  const getStatusColor = (status: string) => {
    const option = statusOptions.find(s => s.value === status)
    return option?.color || "bg-gray-100 text-gray-800"
  }

  const getStatusLabel = (status: string) => {
    const option = statusOptions.find(s => s.value === status)
    return option?.label || status
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card className="w-full max-w-2xl p-6">
          <p className="text-center text-muted-foreground">Loading task details...</p>
        </Card>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card className="w-full max-w-2xl p-6">
          <p className="text-center text-muted-foreground">Task not found</p>
          <Button onClick={onClose} className="mt-4 w-full">Close</Button>
        </Card>
      </div>
    )
  }

  const assigneesList = task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0
    ? task.assignees
    : [{ name: task.assigned_name, email: task.assigned_email }]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-task-green/10 to-primary/10 p-6 sticky top-0 z-10 bg-card">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-task-green" />
            <h2 className="text-xl font-bold text-foreground">Task Details</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Task Description */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
            <p className="text-foreground bg-muted/30 p-4 rounded-lg">{task.description}</p>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Status</h3>
            {isEditingStatus ? (
              <div className="flex gap-2 flex-wrap">
                {statusOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${option.color} ${
                      selectedStatus === option.value ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingStatus(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`px-4 py-2 rounded-lg font-medium text-sm ${getStatusColor(task.status)}`}>
                  {getStatusLabel(task.status)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingStatus(true)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Assignees */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Assigned To</h3>
            <div className="flex flex-wrap gap-2">
              {assigneesList.map((assignee, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <User className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="font-medium text-sm text-blue-900">{assignee.name}</div>
                    <div className="text-xs text-blue-600">{assignee.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Due Date */}
          {task.due_date && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Due Date</h3>
              <div className="flex items-center gap-2 text-foreground">
                <Calendar className="h-4 w-4" />
                <span>{new Date(task.due_date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
            </div>
          )}

          {/* Created Info */}
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Created by {task.creator_name} on {new Date(task.created_at).toLocaleString()}</span>
            </div>
          </div>

          {/* ⭐ NEW: Attachments Section */}
          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments ({attachments.length})
            </h3>

            {/* Upload Button */}
            <div className="mb-4">
              <label htmlFor="file-upload">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingFile}
                  className="cursor-pointer"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingFile ? "Uploading..." : "Upload File"}
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supported: PDF, DOC, DOCX, TXT, Images (Max 10MB)
              </p>
            </div>

            {/* Attachments List */}
            <div className="space-y-2">
              {attachments.length > 0 ? (
                attachments.map(attachment => (
                  <div key={attachment.id} className="flex items-center justify-between bg-muted/30 border border-border rounded-lg p-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{attachment.filename}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={`px-2 py-0.5 rounded ${getFileTypeBadge(attachment.mime_type)}`}>
                            {attachment.mime_type.split('/')[1].toUpperCase()}
                          </span>
                          <span>{formatFileSize(attachment.file_size)}</span>
                          <span>•</span>
                          <span>{new Date(attachment.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(attachment.file_url, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAttachment(attachment)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No attachments yet. Upload one above!</p>
              )}
            </div>
          </div>

          {/* Notes Section */}
          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes ({notes.length})
            </h3>

            {/* Add Note */}
            <div className="mb-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note to this task..."
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none min-h-20"
              />
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim() || savingNote}
                className="mt-2 bg-task-green hover:bg-task-green/90 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                {savingNote ? "Adding..." : "Add Note"}
              </Button>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
              {notes.length > 0 ? (
                notes.map(note => (
                  <div key={note.id} className="bg-muted/30 border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{note.creator_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No notes yet. Add the first one above!</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-muted/20">
          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </div>
      </Card>
    </div>
  )
}
