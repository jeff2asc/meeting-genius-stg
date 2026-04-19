"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, FileText, CheckSquare, Scale, Paperclip, Edit2, Trash2, X, Check, Sparkles, Loader2, Plus, Upload, Download, CornerDownRight, Lock, Unlock, Globe, Archive, ArrowUpCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase, getCurrentUser } from "@/lib/supabase"
import type { TopicAttachment } from "@/lib/supabase"
import { fetchAndExtractBuildingDocuments, fetchAndExtractTopicAttachments } from "@/lib/documentExtractor"
import TaskDetailsModal from "./TaskDetailsModal"
import GeniusWordsInput from "./GeniusWordsInput"
import { toast } from "sonner"
import { formatUtcToLocalDateTime } from "@/lib/timezone"
import { logLlmUsage } from "@/lib/logging"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ⭐ NEW: Debounce hook for auto-save
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// ⭐ UPDATED: Helper function to format ISO string to local datetime string for input
const formatToLocalDateTimeString = (isoString: string) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

interface Topic {
  id: number
  title: string
  description: string | null
  attachments: number
  tasks: number
  decisions: number
  is_incamera?: boolean
  incamera_start_time?: string | null
  incamera_end_time?: string | null
  created_by_name?: string | null
  updated_by_name?: string | null
  is_archived?: boolean
}

interface HistoryItem {
  id: number
  type: "note" | "task" | "decision"
  content: string
  timestamp: string
  details?: string
  attachmentUrl?: string
  visibility?: "public" | "private"
  status?: string
}

interface Decision {
  id: number
  topic_id: number
  motion_text: string
  result: string | null
  votes_for: number | null
  votes_against: number | null
  votes_abstain: number | null
  parent_decision_id: number | null
  recorded_at: string
  edited_at: string | null
  status?: string | null
  children?: Decision[]
}

interface TopicCardProps {
  topic: Topic
  topicNumber: number
  meetingId: number
  meetingStatus?: string
  onUpdate: (updates: Partial<Topic>) => void
  onDelete: (topicId: number) => void
  onTaskClick: () => void
  onNoteClick: () => void
  onDecisionClick: () => void
  onRegisterRefresh?: (topicId: number, callback: () => void) => void
  isReadOnly?: boolean
  onEditDecision?: (decisionId: number, topicId: number) => void
  onAddThreadedDecision?: (parentDecisionId: number, topicId: number) => void
  onEditTask?: (taskId: number, topicId: number) => void
  onEditNote?: (noteId: number, topicId: number) => void
  onRestore?: (topicId: number) => void
  onArchive?: () => void
  buildingInfo?: { id: number; manager_id: number; company_id: number | null }
}

export default function TopicCard({
  topic,
  topicNumber,
  meetingId,
  meetingStatus,
  onUpdate,
  onDelete,
  onTaskClick,
  onNoteClick,
  onDecisionClick,
  onRegisterRefresh,
  isReadOnly = false,
  onEditDecision,
  onAddThreadedDecision,
  onEditTask,
  onEditNote,
  onRestore,
  onArchive,
  buildingInfo
}: TopicCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(topic.title)
  const [editedDescription, setEditedDescription] = useState(topic.description || "")
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [analyzingAI, setAnalyzingAI] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [showAiResult, setShowAiResult] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [buildingData, setBuildingData] = useState<{ id: number; manager_id: number; company_id: number | null } | null>(null)

  const [attachments, setAttachments] = useState<TopicAttachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)

  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loadingDecisions, setLoadingDecisions] = useState(false)

  const [isIncamera, setIsIncamera] = useState(topic.is_incamera || false)
  const [incameraStartTime, setIncameraStartTime] = useState(topic.incamera_start_time || "")
  const [incameraEndTime, setIncameraEndTime] = useState(topic.incamera_end_time || "")

  const debouncedDescription = useDebounce(editedDescription, 3000)

  const currentUser = getCurrentUser()
  const titleInputRef = useRef<HTMLInputElement>(null)

  const isMeetingStarted = meetingStatus === 'working_minutes' || meetingStatus === 'minutes'

  useEffect(() => {
    if (onRegisterRefresh) {
      onRegisterRefresh(topic.id, () => {
        console.log('🔄 REFRESH CALLBACK TRIGGERED for topic:', topic.id)
        fetchHistory()
        fetchDecisions()
      })
    }
  }, [topic.id, onRegisterRefresh])

  useEffect(() => {
    if (isExpanded) {
      fetchHistory()
      fetchAiAnalysis()
      fetchTopicAttachments()
      fetchDecisions()
    }
  }, [topic.id, isExpanded])

  useEffect(() => {
    if (debouncedDescription === topic.description) return
    if (!debouncedDescription && !topic.description) return
    handleAutoSaveDescription()
  }, [debouncedDescription])

  useEffect(() => {
    setEditedDescription(topic.description || "")
    setEditedTitle(topic.title)
    setIsIncamera(topic.is_incamera || false)
    setIncameraStartTime(topic.incamera_start_time || "")
    setIncameraEndTime(topic.incamera_end_time || "")
  }, [topic.description, topic.title, topic.is_incamera, topic.incamera_start_time, topic.incamera_end_time])

  const handleIncameraToggle = async () => {
    if (isReadOnly) {
      alert('You do not have permission to modify topics.')
      return
    }

    const newValue = !isIncamera
    setIsIncamera(newValue)

    if (newValue) {
      const now = new Date().toISOString()
      setIncameraStartTime(now)
      await onUpdate({
        is_incamera: newValue,
        incamera_start_time: now
      })
    } else {
      await onUpdate({ is_incamera: newValue })
    }

    toast.success(newValue ? '🔒 Topic marked as In-Camera' : '🔓 In-Camera removed')
  }

  const handleTimeUpdate = async (field: 'start' | 'end', value: string) => {
    if (isReadOnly) return

    const isoValue = value ? new Date(value).toISOString() : ''

    if (field === 'start') {
      setIncameraStartTime(isoValue)
      await onUpdate({ incamera_start_time: isoValue })
    } else {
      setIncameraEndTime(isoValue)
      await onUpdate({ incamera_end_time: isoValue })
    }
  }

  // ⭐ NEW: Delete handlers
  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)

      if (error) {
        console.error('Error deleting note:', error)
        toast.error('Failed to delete note')
        return
      }

      toast.success('Note deleted successfully')
      fetchHistory()
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Failed to delete note')
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) {
        console.error('Error deleting task:', error)
        toast.error('Failed to delete task')
        return
      }

      toast.success('Task deleted successfully')
      fetchHistory()
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Failed to delete task')
    }
  }

  const handleToggleTaskStatus = async (taskId: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'completed' ? 'open' : 'completed'
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)

      if (error) {
        console.error('Error updating task status:', error)
        toast.error('Failed to update task')
        return
      }

      toast.success(newStatus === 'completed' ? 'Task marked as completed' : 'Task reopened')
      fetchHistory()
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Failed to update task')
    }
  }

  const handleDeleteDecision = async (decisionId: number) => {
    if (!confirm('Are you sure you want to delete this decision? This will also delete any threaded decisions under it.')) return

    try {
      const { error } = await supabase
        .from('decisions')
        .delete()
        .eq('id', decisionId)

      if (error) {
        console.error('Error deleting decision:', error)
        toast.error('Failed to delete decision')
        return
      }

      toast.success('Decision deleted successfully')
      fetchDecisions()
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Failed to delete decision')
    }
  }

  const fetchDecisions = async () => {
    setLoadingDecisions(true)
    try {
      const { data, error } = await supabase
        .from('decisions')
        .select('*')
        .eq('topic_id', topic.id)
        .order('recorded_at', { ascending: false })

      if (error) {
        console.error('Error fetching decisions:', error)
        return
      }

      if (data) {
        const decisionsMap = new Map<number, Decision>()
        const rootDecisions: Decision[] = []

        data.forEach(d => {
          decisionsMap.set(d.id, { ...d, children: [] })
        })

        data.forEach(d => {
          const decision = decisionsMap.get(d.id)!
          if (d.parent_decision_id) {
            const parent = decisionsMap.get(d.parent_decision_id)
            if (parent) {
              parent.children!.push(decision)
            } else {
              rootDecisions.push(decision)
            }
          } else {
            rootDecisions.push(decision)
          }
        })

        setDecisions(rootDecisions)
      }
    } catch (err) {
      console.error('Unexpected error fetching decisions:', err)
    } finally {
      setLoadingDecisions(false)
    }
  }

  const fetchTopicAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('topic_attachments')
        .select('*')
        .eq('topic_id', topic.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching topic attachments:', error)
        return
      }

      setAttachments(data || [])
    } catch (err) {
      console.error('Unexpected error fetching attachments:', err)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    setUploadingFile(true)
    try {
      const currentUser = getCurrentUser()

      if (!currentUser) {
        alert('You must be logged in to upload files')
        setUploadingFile(false)
        return
      }

      const fileName = `${topic.id}/${Date.now()}_${file.name}`
      const filePath = fileName

      const { error: uploadError } = await supabase.storage
        .from('topic-attachments')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        alert('Failed to upload file: ' + uploadError.message)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('topic-attachments')
        .getPublicUrl(filePath)

      const { error: dbError } = await supabase
        .from('topic_attachments')
        .insert({
          topic_id: topic.id,
          filename: file.name,
          file_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: currentUser.id
        })

      if (dbError) {
        console.error('Error saving attachment:', dbError)
        alert('Failed to save attachment: ' + dbError.message)
        return
      }

      alert('File uploaded successfully')
      await fetchTopicAttachments()

      onUpdate({ attachments: attachments.length + 1 })
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('Failed to upload file')
    } finally {
      setUploadingFile(false)
      event.target.value = ''
    }
  }

  const handleDeleteAttachment = async (attachment: TopicAttachment) => {
    if (!confirm(`Delete ${attachment.filename}?`)) return

    try {
      const urlParts = attachment.file_url.split('/topic-attachments/')
      const filePath = urlParts[1]

      const { error: storageError } = await supabase.storage
        .from('topic-attachments')
        .remove([filePath])

      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
      }

      const { error: dbError } = await supabase
        .from('topic_attachments')
        .delete()
        .eq('id', attachment.id)

      if (dbError) {
        console.error('Error deleting attachment:', dbError)
        alert('Failed to delete attachment')
        return
      }

      alert('Attachment deleted')
      await fetchTopicAttachments()

      onUpdate({ attachments: attachments.length - 1 })
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('Failed to delete attachment')
    }
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

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const historyItems: HistoryItem[] = []
      const currentUser = getCurrentUser()

      // Fetch the topic with building info to check permissions
      const { data: topicWithBuilding, error: topicError } = await supabase
        .from('topics')
        .select(`
          title, 
          meeting_id, 
          meetings!inner(
            building_id, 
            meeting_type,
            buildings!inner(
              id,
              manager_id,
              company_id
            )
          )
        `)
        .eq('id', topic.id)
        .single()

      if (topicError || !topicWithBuilding) {
        console.error('Error fetching topic building info:', topicError)
        setLoadingHistory(false)
        return
      }

      const meetingData = topicWithBuilding.meetings as any
      const building = meetingData?.buildings
      setBuildingData(building)

      // 1. Only fetch items for the current topic since rollover now clones them
      const topicIds = [topic.id]

      // 2. Fetch notes
      const { data: notes } = await supabase
        .from('notes')
        .select('id, content, created_at, created_by, visibility, status')
        .eq('topic_id', topic.id)
        .order('created_at', { ascending: false })

      if (notes) {
        notes.forEach(note => {
          let canSee = false
          if (note.visibility === 'public' || !note.visibility) {
            canSee = true
          } else if (currentUser) {
            if (note.created_by === currentUser.id) canSee = true
            else if (currentUser.user_type === 'master') canSee = true
            else if (currentUser.user_type === 'corporate_administrator' && currentUser.company_id === building.company_id) canSee = true
            else if (currentUser.user_type === 'property_manager' && currentUser.id === building.manager_id) canSee = true
          }

          if (canSee) {
            historyItems.push({
              id: note.id,
              type: 'note',
              content: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
              timestamp: formatUtcToLocalDateTime(note.created_at),
              visibility: (note.visibility as "public" | "private") || "public",
              status: note.status || 'open'
            })
          }
        })
      }

      // 3. Fetch tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, description, assigned_name, assigned_email, status, created_at')
        .eq('topic_id', topic.id)
        .in('status', ['open', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })

      if (tasks) {
        tasks.forEach(task => {
          const assignee = task.assigned_name || task.assigned_email || 'Unassigned'
          historyItems.push({
            id: task.id,
            type: 'task',
            content: task.description.substring(0, 100) + (task.description.length > 100 ? '...' : ''),
            timestamp: formatUtcToLocalDateTime(task.created_at),
            details: `Assigned to: ${assignee} · Status: ${task.status}`,
            status: task.status
          })
        })
      }

      historyItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setHistory(historyItems)
    } catch (err) {
      console.error('Error fetching history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const fetchAiAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_analyses')
        .select('analysis_result')
        .eq('topic_id', topic.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching AI analysis:', error)
        return
      }

      if (data) setAiAnalysis(data.analysis_result)
    } catch (err) {
      console.error('Unexpected error fetching AI analysis:', err)
    }
  }

  const handleAiAnalysis = async () => {
    if (isReadOnly) {
      alert('You do not have permission to analyze topics.')
      return
    }
    if (!editedDescription || editedDescription.trim() === '') {
      alert('Please add a description first before analyzing with AI')
      return
    }

    setAnalyzingAI(true)
    setShowAiResult(false)

    try {
      const { data: topicData, error: topicError } = await supabase
        .from('topics')
        .select(`
          meeting_id,
          meetings!inner(
            building_id,
            buildings!inner(name)
          )
        `)
        .eq('id', topic.id)
        .single()

      if (topicError || !topicData) {
        alert('Could not find topic information')
        setAnalyzingAI(false)
        return
      }

      const meetingData = topicData.meetings as any
      const buildingId = meetingData?.building_id
      const buildingName = meetingData?.buildings?.name

      if (!buildingId || !buildingName) {
        alert('Could not find building information')
        setAnalyzingAI(false)
        return
      }

      console.log('Fetching building documents for building ID:', buildingId)
      const buildingDocuments = await fetchAndExtractBuildingDocuments(buildingId)
      console.log(`Fetched ${buildingDocuments.length} building documents`)

      console.log('Fetching topic attachments for topic ID:', topic.id)
      const topicAttachments = await fetchAndExtractTopicAttachments(topic.id)
      console.log(`Fetched ${topicAttachments.length} topic attachments`)

      const startTime = Date.now()
      const response = await fetch('https://rulesengine.asccreative.com/webhook/843afc5f-abe0-4bb4-bb9f-369d2657c4d0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topic.id,
          topic_title: topic.title,
          building_id: buildingId,
          building_name: buildingName,
          description: editedDescription,
          building_documents: buildingDocuments,
          topic_attachments: topicAttachments,
        }),
      })

      if (response.ok) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        await fetchAiAnalysis()
        setShowAiResult(true)
        
        // Log successful analysis
        logLlmUsage({
          user_id: currentUser?.id,
          company_id: buildingData?.company_id,
          action_type: "topic_ai_analysis",
          model_name: "n8n-webhook-analysis",
          status: "success",
          duration_ms: Date.now() - startTime
        })
        
        alert('✅ AI Analysis complete!')
      } else {
        // Log failed attempt
        logLlmUsage({
          user_id: currentUser?.id,
          company_id: buildingData?.company_id,
          action_type: "topic_ai_analysis",
          model_name: "n8n-webhook-analysis",
          status: "failure",
          duration_ms: Date.now() - startTime,
          error_message: `Webhook returned status ${response.status}`
        })
        alert('Failed to analyze with AI. Please try again.')
      }
    } catch (error) {
      console.error('Error during AI analysis:', error)
      alert('An error occurred during AI analysis')
    } finally {
      setAnalyzingAI(false)
    }
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !saving) {
      e.preventDefault()
      handleSaveTitle()
    }
    if (e.key === 'Escape') {
      handleCancelTitle()
    }
  }

  const handleAutoSaveDescription = async () => {
    if (isReadOnly) return
    if (saving) return

    setSaving(true)
    await onUpdate({ 
      description: editedDescription,
      updated_by_name: currentUser?.name || "User"
    })
    setSaving(false)

    console.log('Description saved')
  }

  const handleSaveTitle = async () => {
    if (saving) return
    setSaving(true)
    await onUpdate({ 
      title: editedTitle,
      updated_by_name: currentUser?.name || "User"
    })
    setIsEditingTitle(false)
    setSaving(false)
    fetchHistory()
  }

  const handleEditTitle = () => {
    if (isReadOnly) {
      alert('You do not have permission to edit topics.')
      return
    }
    setIsEditingTitle(true)
  }

  const handleCancelTitle = () => {
    setEditedTitle(topic.title)
    setIsEditingTitle(false)
  }

  const handleArchive = async () => {
    if (isReadOnly) return
    if (!confirm('Are you sure you want to archive this topic? It will be moved to the storage but can be retrieved later.')) return
    
    try {
      const { error } = await supabase
        .from('topics')
        .update({ is_archived: true })
        .eq('id', topic.id)

      if (error) {
        console.error('Error archiving topic:', error)
        toast.error('Failed to archive topic')
        return
      }

      toast.success('Topic archived successfully')
      if (onArchive) {
        onArchive()
      } else {
        onDelete(topic.id) // Fallback for safety, though onArchive is preferred
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Failed to archive topic')
    }
  }

  const handleRestoreTopic = async () => {
    if (!onRestore) return
    if (!confirm('Bring this topic back to the active agenda?')) return
    
    try {
      const { error } = await supabase
        .from('topics')
        .update({ is_archived: false })
        .eq('id', topic.id)

      if (error) {
        console.error('Error restoring topic:', error)
        toast.error('Failed to restore topic')
        return
      }

      toast.success('Topic restored successfully')
      onRestore(topic.id)
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Failed to restore topic')
    }
  }

  const handleDelete = async () => {
    if (isReadOnly) {
      alert('You do not have permission to delete topics.')
      return
    }
    await onDelete(topic.id)
    setShowDeleteConfirm(false)
  }

  const getHistoryBadgeColor = (type: string) => {
    switch (type) {
      case 'note': return 'bg-note-blue/10 text-note-blue border-note-blue/20'
      case 'task': return 'bg-task-green/10 text-task-green border-task-green/20'
      case 'decision': return 'bg-decision-purple/10 text-decision-purple border-decision-purple/20'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  // ⭐ UPDATED: Render decision with DELETE button
  const renderDecision = (decision: Decision, depth: number = 0) => {
    const hasChildren = decision.children && decision.children.length > 0

    return (
      <div key={decision.id} className={depth > 0 ? 'ml-6 mt-2' : ''}>
        <div className="flex flex-col gap-1 rounded bg-background border border-border px-2 py-1.5 relative">
          {depth > 0 && (
            <div className="absolute -left-3 top-3 text-purple-400">
              <CornerDownRight className="h-4 w-4" />
            </div>
          )}

          <div className="flex-1">
            <div className="flex gap-2 items-center mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded border bg-decision-purple/10 text-decision-purple border-decision-purple/20">
                DECISION {depth > 0 && '(THREADED)'}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatUtcToLocalDateTime(decision.recorded_at)}
              </span>
              {decision.edited_at && (
                <span className="text-xs text-amber-600">(Edited)</span>
              )}
            </div>
            <p className={`text-sm mb-1 ${decision.status === 'completed' ? 'line-through text-muted-foreground italic' : 'text-foreground'}`}>{decision.motion_text}</p>
            {(decision.result || decision.votes_for !== null || decision.votes_against !== null) && (
              <p className="text-xs text-muted-foreground">
                {decision.result && `Result: ${decision.result}`}
                {(decision.votes_for !== null || decision.votes_against !== null) && ` · Votes: ${decision.votes_for || 0} for, ${decision.votes_against || 0} against`}
                {decision.votes_abstain !== null && decision.votes_abstain > 0 && `, ${decision.votes_abstain} abstain`}
              </p>
            )}
          </div>

          {/* ⭐ UPDATED: Action Buttons with DELETE */}
          {!isReadOnly && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  console.log('Edit button clicked:', decision.id, topic.id)
                  if (onEditDecision) {
                    onEditDecision(decision.id, topic.id)
                  }
                }}
                className="text-purple-600 border-purple-600 hover:bg-purple-50"
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  console.log('Add threaded button clicked:', decision.id, topic.id)
                  if (onAddThreadedDecision) {
                    onAddThreadedDecision(decision.id, topic.id)
                  }
                }}
                className="text-purple-600 border-purple-600 hover:bg-purple-50"
              >
                <Plus className="h-3 w-3 mr-1" />
                Thread
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeleteDecision(decision.id)}
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </div>

        {hasChildren && (
          <div className="mt-1">
            {decision.children!.map(child => renderDecision(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Card className="border-0 bg-card shadow-md overflow-hidden mb-1">
        <div className={`border-b border-border p-2 ${isIncamera ? 'bg-gradient-to-r from-red-50 to-orange-50' : 'bg-gradient-to-r from-primary/5 to-decision-purple/5'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
              >
                <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
              </button>
              <span className="text-sm font-semibold text-muted-foreground">Topic {topicNumber}</span>

              {isIncamera && (
                <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 border border-red-300 rounded text-xs font-semibold">
                  <Lock className="h-3 w-3" />
                  IN-CAMERA
                </span>
              )}

              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  value={editedTitle}
                  onChange={handleTitleChange}
                  onKeyDown={handleTitleKeyDown}
                  className="flex-1 bg-background px-2 py-1 rounded border border-primary text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Topic title..."
                  autoFocus
                  disabled={isReadOnly}
                />
              ) : (
                <h3 className="flex-1 font-semibold text-foreground">
                  {topic.title}
                </h3>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isReadOnly && isMeetingStarted && (
                <button
                  onClick={handleIncameraToggle}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-all border-2 ${isIncamera
                    ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                    : 'bg-muted hover:bg-muted/80 border-border hover:border-red-300'
                    }`}
                  title={isIncamera ? "Remove In-Camera status" : "Mark as In-Camera (Confidential)"}
                >
                  {isIncamera ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  {isIncamera ? 'In-Camera' : 'In-Camera'}
                </button>
              )}

              <button
                onClick={() => setShowAttachments(!showAttachments)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 rounded transition-colors"
                title="View attachments"
              >
                <Paperclip className="h-4 w-4" />
                {attachments.length}
              </button>

              {isReadOnly && onRestore && (
                <button
                  onClick={handleRestoreTopic}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-100/50 text-amber-800 hover:bg-amber-100 rounded transition-colors border border-amber-200/50 shadow-sm"
                  title="Restore to active agenda"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Restore
                </button>
              )}

              {!isEditingTitle && !isReadOnly && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleEditTitle}
                    className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors text-primary"
                    title="Edit title"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleArchive}
                    className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors text-amber-600"
                    title="Move to Topic Bank (Archive)"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors text-destructive"
                    title="Delete topic"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {!isReadOnly && isMeetingStarted && isIncamera && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <label className="text-muted-foreground font-medium">Start:</label>
                  <input
                    type="datetime-local"
                    value={formatToLocalDateTimeString(incameraStartTime)}
                    onChange={(e) => handleTimeUpdate('start', e.target.value)}
                    className="px-2 py-1 rounded border border-border text-xs bg-background"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-muted-foreground font-medium">End:</label>
                  <input
                    type="datetime-local"
                    value={formatToLocalDateTimeString(incameraEndTime)}
                    onChange={(e) => handleTimeUpdate('end', e.target.value)}
                    className="px-2 py-1 rounded border border-border text-xs bg-background"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {isEditingTitle && !isReadOnly && (
          <div className="px-2 py-1.5 bg-muted/20 border-b border-border flex gap-2">
            <Button onClick={handleCancelTitle} variant="outline" className="flex-1">
              <X className="h-4 w-4 mr-2" />Cancel
            </Button>
            <Button onClick={handleSaveTitle} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90">
              <Check className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Title"}
            </Button>
          </div>
        )}

        {isExpanded && (
          <>
            {isIncamera && (
              <div className="border-b border-border p-3 bg-red-50">
                <div className="flex items-start gap-2 text-sm text-red-800">
                  <Lock className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">This topic is In-Camera (Confidential)</p>
                    <p className="text-xs mt-1">
                      Content will be hidden in published agendas and minutes. Only "This topic is in-camera" will be shown.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {showAttachments && (
              <div className="border-b border-border p-1 bg-muted/10">
                <h4 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Topic Attachments ({attachments.length})
                </h4>

                {!isReadOnly && (
                  <div className="mb-1.5">
                    <label htmlFor={`topic-file-upload-${topic.id}`}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingFile}
                        className="cursor-pointer"
                        onClick={() => document.getElementById(`topic-file-upload-${topic.id}`)?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingFile ? "Uploading..." : "Upload File"}
                      </Button>
                    </label>
                    <input
                      id={`topic-file-upload-${topic.id}`}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Supported: PDF, DOC, DOCX, TXT, Images (Max 10MB)
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  {attachments.length > 0 ? (
                    attachments.map(attachment => (
                      <div key={attachment.id} className="flex items-center justify-between bg-background border border-border rounded-lg p-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs truncate">{attachment.filename}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${getFileTypeBadge(attachment.mime_type)}`}>
                                {attachment.mime_type.split('/')[1].toUpperCase()}
                              </span>
                              <span>{formatFileSize(attachment.file_size)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(attachment.file_url, '_blank')}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          {!isReadOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAttachment(attachment)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-xs text-muted-foreground py-3">
                      {isReadOnly ? 'No attachments yet.' : 'No attachments yet. Upload one above!'}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="p-2 border-b border-border">
              {!isReadOnly ? (
                <>
                  <GeniusWordsInput
                    value={editedDescription}
                    onChange={setEditedDescription}
                    placeholder="Add description here... (Type # for shortcuts)"
                    rows={2}
                  />
                  {saving && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <span className="animate-pulse">💾 Saving...</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="min-h-[2.5rem] text-foreground p-1.5 mb-1.5">
                  {topic.description || <span className="text-muted-foreground">No description yet...</span>}
                </div>
              )}

              {/* Audit Info */}
              {(topic.created_by_name || topic.updated_by_name) && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground font-medium italic mb-2 px-1">
                  {topic.created_by_name && (
                    <span>👤 Added by: {topic.created_by_name}</span>
                  )}
                  {topic.updated_by_name && (
                    <span>✏️ Last edited by: {topic.updated_by_name}</span>
                  )}
                </div>
              )}

              {editedDescription && !isReadOnly && (
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={handleAiAnalysis}
                    disabled={analyzingAI}
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90"
                  >
                    {analyzingAI ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" /> 🤖 Analyze with AI
                      </>
                    )}
                  </Button>
                  {aiAnalysis && (
                    <Button
                      onClick={() => setShowAiResult(!showAiResult)}
                      variant="outline"
                      size="sm"
                    >
                      {showAiResult ? 'Hide' : 'Show'} Analysis
                    </Button>
                  )}
                  {topic.is_archived && onRestore && (
                    <Button
                      onClick={handleRestoreTopic}
                      variant="outline"
                      size="sm"
                      className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Restore Topic
                    </Button>
                  )}
                  {!topic.is_archived && !isReadOnly && (
                    <Button
                      onClick={handleArchive}
                      variant="outline"
                      size="sm"
                      className="text-amber-600 border-amber-600 hover:bg-amber-50"
                    >
                      <Download className="h-4 w-4 mr-2" /> Archive Topic
                    </Button>
                  )}
                </div>
              )}

              {showAiResult && aiAnalysis && (
                <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-900">AI Analysis Result</h4>
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">
                    {aiAnalysis}
                  </div>
                </div>
              )}
            </div>

            {!isReadOnly && (
              <div className="flex gap-2 border-b border-border bg-muted/30 p-2">
                <Button size="sm" className="flex-1 bg-note-blue text-white hover:bg-note-blue/90" onClick={onNoteClick}>
                  <FileText className="h-4 w-4 mr-2" />📝 Note
                </Button>
                <Button size="sm" className="flex-1 bg-task-green text-white hover:bg-task-green/90" onClick={onTaskClick}>
                  <CheckSquare className="h-4 w-4 mr-2" />✓ Task
                </Button>
                <Button size="sm" className="flex-1 bg-decision-purple text-white hover:bg-decision-purple/90" onClick={onDecisionClick}>
                  <Scale className="h-4 w-4 mr-2" />⚖️ Decision
                </Button>
              </div>
            )}

            <div className="p-2">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                📋 History & Progress
              </h3>

              {loadingHistory ? (
                <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
              ) : history.length > 0 || decisions.length > 0 ? (
                <div className="space-y-2">
                  {decisions.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Decisions</h4>
                      {decisions.map(decision => renderDecision(decision))}
                    </div>
                  )}

                  {history.map(item => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex flex-col gap-1 rounded bg-background border border-border px-2 py-1.5 cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => {
                        if (item.type === 'task') {
                          setSelectedTaskId(item.id)
                        }
                      }}
                    >
                      <div className="flex gap-2 items-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded border inline-flex items-center gap-1.5 ${getHistoryBadgeColor(item.type)}`}>
                          {item.type === 'note' && (
                            item.visibility === 'private' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />
                          )}
                          {item.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                      </div>
                      <p className={`text-sm ${((item.type === 'task' || item.type === 'note') && item.status === 'completed') ? 'line-through text-muted-foreground italic' : 'text-foreground'}`}>{item.content}</p>
                      {item.details && (
                        <p className="text-xs text-muted-foreground">{item.details}</p>
                      )}
                      {item.type === 'task' && !isReadOnly && (
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleTaskStatus(item.id, item.status || 'open')
                            }}
                            className={item.status === 'completed' 
                              ? "text-amber-600 border-amber-600 hover:bg-amber-50"
                              : "text-green-600 border-green-600 hover:bg-green-50"
                            }
                          >
                            {item.status === 'completed' ? (
                              <>
                                <X className="h-3 w-3 mr-1" />
                                Reopen
                              </>
                            ) : (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Complete
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onEditTask) {
                                onEditTask(item.id, topic.id)
                              }
                            }}
                            className="text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteTask(item.id)
                            }}
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                      {item.type === 'note' && !isReadOnly && (
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onEditNote) {
                                onEditNote(item.id, topic.id)
                              }
                            }}
                            className="text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteNote(item.id)
                            }}
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground py-3">
                  No history yet. Add notes, tasks, or decisions to get started!
                </p>
              )}
            </div>
          </>
        )}
      </Card>

      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* ✅ NEW: AlertDialog for topic delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this topic? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Topic
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
