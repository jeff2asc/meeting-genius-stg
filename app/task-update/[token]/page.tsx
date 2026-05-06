"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Clock, AlertCircle, Ban, Paperclip, Download, MessageSquare, Upload, Trash2, Save, AlertTriangle } from "lucide-react"

interface TaskAttachment {
  id: number
  filename: string
  file_url: string
  file_size: number
  mime_type: string
  created_at: string
}

interface TaskNote {
  id: number
  content: string
  created_at: string
  created_by: string | null
}

export default function TaskUpdatePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  
  // Track changes
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [originalStatus, setOriginalStatus] = useState<string>("")
  const [hasStatusChange, setHasStatusChange] = useState(false)
  const [hasAttachmentChange, setHasAttachmentChange] = useState(false)
  const [hasNoteChange, setHasNoteChange] = useState(false)
  
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [notes, setNotes] = useState<TaskNote[]>([])
  const [newNote, setNewNote] = useState("")
  const [uploadingFile, setUploadingFile] = useState(false)
  
  // Pending changes
  const [pendingNotes, setPendingNotes] = useState<string[]>([])
  const [pendingAttachments, setPendingAttachments] = useState<TaskAttachment[]>([])
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([])

  useEffect(() => {
    if (token) {
      fetchTask()
    }
  }, [token])

  useEffect(() => {
    // Check if status changed
    const statusChanged = task && selectedStatus !== originalStatus
    setHasStatusChange(statusChanged)
  }, [selectedStatus, originalStatus, task])

  // Check if there are any changes
  const hasChanges = hasStatusChange || hasAttachmentChange || hasNoteChange || newNote.trim() !== ""

  const fetchTask = async () => {
    try {
      setLoading(true)

      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          topic:topics(
            id,
            title,
            meeting_id,
            meeting:meetings(
              id,
              title,
              building_id,
              buildings(name)
            )
          )
        `)
        .eq('external_update_token', token)
        .single()

      if (taskError || !taskData) {
        setError('Task not found or link expired')
        setLoading(false)
        return
      }

      if (taskData.token_expires_at) {
        const expiryDate = new Date(taskData.token_expires_at)
        if (expiryDate < new Date()) {
          setError('This link has expired')
          setLoading(false)
          return
        }
      }

      setTask(taskData)
      setSelectedStatus(taskData.status)
      setOriginalStatus(taskData.status)

      const { data: attachmentsData } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskData.id)
        .order('created_at', { ascending: false })

      if (attachmentsData) {
        setAttachments(attachmentsData)
      }

      const { data: notesData } = await supabase
        .from('task_notes')
        .select('*')
        .eq('task_id', taskData.id)
        .order('created_at', { ascending: false })

      if (notesData) {
        setNotes(notesData)
      }

      setLoading(false)
    } catch (err) {
      setError('Failed to load task')
      setLoading(false)
    }
  }

  const handleSaveAllChanges = async () => {
    if (!task || !hasChanges) return

    setSaving(true)
    try {
      // 1. Update status if changed
      if (hasStatusChange) {
        const { error: statusError } = await supabase
          .from('tasks')
          .update({ status: selectedStatus })
          .eq('id', task.id)

        if (statusError) {
          alert('Failed to save status changes')
          setSaving(false)
          return
        }
      }

      // 2. Save pending notes
      if (pendingNotes.length > 0 || newNote.trim() !== "") {
        const notesToInsert = [...pendingNotes]
        if (newNote.trim() !== "") {
          notesToInsert.push(newNote.trim())
        }

        for (const noteContent of notesToInsert) {
          const { data, error } = await supabase
            .from('task_notes')
            .insert({
              task_id: task.id,
              content: noteContent,
              created_by: null
            })
            .select()
            .single()

          if (error) {
            alert('Failed to save some notes')
            setSaving(false)
            return
          }

          setNotes(prev => [data, ...prev])
        }
      }

      // 3. Process deleted attachments
      if (deletedAttachmentIds.length > 0) {
        for (const attachmentId of deletedAttachmentIds) {
          await supabase
            .from('task_attachments')
            .delete()
            .eq('id', attachmentId)
        }
      }

      // Reset all pending changes
      setTask({ ...task, status: selectedStatus })
      setOriginalStatus(selectedStatus)
      setHasStatusChange(false)
      setHasAttachmentChange(false)
      setHasNoteChange(false)
      setPendingNotes([])
      setPendingAttachments([])
      setDeletedAttachmentIds([])
      setNewNote("")
      setSuccess(true)
      
      setTimeout(() => {
        setSuccess(false)
      }, 3000)
    } catch (err) {
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !task) return

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    setUploadingFile(true)
    try {
      const fileName = `${task.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file)

      if (uploadError) {
        alert('Failed to upload file')
        setUploadingFile(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(fileName)

      const { data: attachmentData, error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: task.id,
          filename: file.name,
          file_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: null
        })
        .select()
        .single()

      if (dbError) {
        alert('Failed to save attachment')
        setUploadingFile(false)
        return
      }

      setAttachments([attachmentData, ...attachments])
      setPendingAttachments(prev => [attachmentData, ...prev])
      setHasAttachmentChange(true)
    } catch (err) {
      alert('Failed to upload file')
    } finally {
      setUploadingFile(false)
      event.target.value = ''
    }
  }

  const handleDeleteAttachment = async (attachment: TaskAttachment) => {
    if (!confirm(`Delete ${attachment.filename}?`)) return

    try {
      const urlParts = attachment.file_url.split('/task-attachments/')
      const filePath = urlParts[1]

      await supabase.storage
        .from('task-attachments')
        .remove([filePath])

      setAttachments(attachments.filter(a => a.id !== attachment.id))
      setDeletedAttachmentIds(prev => [...prev, attachment.id])
      setHasAttachmentChange(true)
    } catch (err) {
      alert('Failed to delete attachment')
    }
  }

  const handleAddNoteToPending = () => {
    if (!newNote.trim()) return
    setHasNoteChange(true)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
    if (mimeType.includes('image')) return '🖼️'
    if (mimeType.includes('text')) return '📃'
    return '📎'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-4 w-4" />
      case 'in_progress':
        return <AlertCircle className="h-4 w-4" />
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'blocked':
        return <Ban className="h-4 w-4" />
      default:
        return null
    }
  }

  const getStatusStyle = (status: string, isSelected: boolean) => {
    const baseStyle = "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border-2 cursor-pointer transition-all"
    
    if (isSelected) {
      switch (status) {
        case 'open':
          return `${baseStyle} bg-blue-500 text-white border-blue-500`
        case 'in_progress':
          return `${baseStyle} bg-yellow-500 text-white border-yellow-500`
        case 'completed':
          return `${baseStyle} bg-green-500 text-white border-green-500`
        case 'blocked':
          return `${baseStyle} bg-red-500 text-white border-red-500`
      }
    }
    
    switch (status) {
      case 'open':
        return `${baseStyle} bg-white text-blue-700 border-blue-300 hover:bg-blue-50`
      case 'in_progress':
        return `${baseStyle} bg-white text-yellow-700 border-yellow-300 hover:bg-yellow-50`
      case 'completed':
        return `${baseStyle} bg-white text-green-700 border-green-300 hover:bg-green-50`
      case 'blocked':
        return `${baseStyle} bg-white text-red-700 border-red-300 hover:bg-red-50`
      default:
        return `${baseStyle} bg-white text-gray-700 border-gray-300 hover:bg-gray-50`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading task...</p>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push('/')} variant="outline">
            Go to Dashboard
          </Button>
        </Card>
      </div>
    )
  }

  if (!task) return null

  const meeting = (task.topic as any)?.meeting
  const building = meeting?.buildings

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-3xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src="/MG2 logo.png" 
            alt="Meeting Genius Logo" 
            className="h-12 w-auto mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Update Task Status</h1>
          <p className="text-gray-600">Update the status of your assigned task</p>
        </div>

        {/* Success Message */}
        {success && (
          <Card className="p-4 mb-6 bg-green-50 border-green-200">
            <div className="flex items-center gap-3 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">All changes saved successfully!</span>
            </div>
          </Card>
        )}

        {/* Unsaved Changes Warning */}
        {hasChanges && (
          <Card className="p-4 mb-6 bg-orange-50 border-orange-200">
            <div className="flex items-center gap-3 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">You have unsaved changes. Scroll down and click "Save All Changes".</span>
            </div>
          </Card>
        )}

        {/* Task Details */}
        <Card className="p-6 mb-6">
          <div className="space-y-4">
            <div className="pb-4 border-b">
              <div className="text-sm text-gray-500 mb-1">Meeting</div>
              <div className="font-semibold text-gray-900">{meeting?.title}</div>
              {building && (
                <div className="text-sm text-gray-600">{building.name}</div>
              )}
            </div>

            <div className="pb-4 border-b">
              <div className="text-sm text-gray-500 mb-1">Topic</div>
              <div className="font-semibold text-gray-900">{(task.topic as any)?.title}</div>
            </div>

            <div className="pb-4 border-b">
              <div className="text-sm text-gray-500 mb-1">Task</div>
              <div className="text-gray-900 whitespace-pre-wrap">{task.description}</div>
            </div>

            {task.due_date && (
              <div className="pb-4 border-b">
                <div className="text-sm text-gray-500 mb-1">Due Date</div>
                <div className="text-gray-900">
                  {new Date(task.due_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            )}

            {/* Current Status with Update Options */}
            <div>
              <div className="text-sm text-gray-500 mb-3">Current Status</div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setSelectedStatus('open')}
                  className={getStatusStyle('open', selectedStatus === 'open')}
                >
                  {getStatusIcon('open')}
                  <span>Open</span>
                </button>

                <button
                  onClick={() => setSelectedStatus('in_progress')}
                  className={getStatusStyle('in_progress', selectedStatus === 'in_progress')}
                >
                  {getStatusIcon('in_progress')}
                  <span>In Progress</span>
                </button>

                <button
                  onClick={() => setSelectedStatus('completed')}
                  className={getStatusStyle('completed', selectedStatus === 'completed')}
                >
                  {getStatusIcon('completed')}
                  <span>Completed</span>
                </button>

                <button
                  onClick={() => setSelectedStatus('blocked')}
                  className={getStatusStyle('blocked', selectedStatus === 'blocked')}
                >
                  {getStatusIcon('blocked')}
                  <span>Blocked</span>
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Attachments */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments ({attachments.length})
            </h3>
            <label htmlFor="file-upload">
              <Button variant="outline" size="sm" disabled={uploadingFile} asChild>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingFile ? 'Uploading...' : 'Upload File'}
                </span>
              </Button>
            </label>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploadingFile}
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.xls"
            />
          </div>

          {attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl">{getFileIcon(attachment.mime_type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{attachment.filename}</div>
                      <div className="text-sm text-gray-500">{formatFileSize(attachment.file_size)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <a
                      href={attachment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAttachment(attachment)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-gray-300 rounded-lg">
              No attachments yet. Upload a file to get started!
            </div>
          )}
        </Card>

        {/* Notes Section */}
        <Card className="p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notes & Updates ({notes.length})
          </h3>

          <div className="mb-4">
            <textarea
              value={newNote}
              onChange={(e) => {
                setNewNote(e.target.value)
                handleAddNoteToPending()
              }}
              placeholder="Add a note or update about this task..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
          </div>

          {notes.length > 0 ? (
            <div className="space-y-3 pt-4 border-t">
              {notes.map((note) => (
                <div key={note.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {note.created_by || 'External User'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(note.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm border-t">
              No notes yet. Be the first to add an update!
            </div>
          )}
        </Card>

        {/* Save All Changes Button */}
        {hasChanges && (
          <Card className="p-6 mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
            <Button
              onClick={handleSaveAllChanges}
              disabled={saving}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white hover:opacity-90 py-6 text-lg font-semibold"
            >
              <Save className="h-5 w-5 mr-2" />
              {saving ? 'Saving All Changes...' : 'Save All Changes'}
            </Button>
            <p className="text-center text-sm text-gray-600 mt-3">
              This will save your status update, new attachments, and notes
            </p>
          </Card>
        )}

        {/* Go to Meeting Genius Button */}
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <div className="text-center">
            <p className="text-gray-700 mb-4 font-medium">
              Want to see more details or manage other tasks?
            </p>
            <Button
              onClick={() => router.push('/')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 px-8 py-3 text-base"
            >
              Go to Meeting Genius
            </Button>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600">
          Powered by <span className="font-semibold text-blue-600">Meeting Genius</span>
        </div>
      </div>
    </div>
  )
}
