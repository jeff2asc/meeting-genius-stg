"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, FileText, CheckSquare, Scale, Paperclip, Edit2, Trash2, X, Check, Sparkles, Loader2, Plus, Upload, Download, CornerDownRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase, getCurrentUser, TopicAttachment } from "@/lib/supabase"
import { fetchAndExtractBuildingDocuments, fetchAndExtractTopicAttachments } from "@/lib/documentExtractor"
import TaskDetailsModal from "./TaskDetailsModal"
import GeniusWordsInput from "./GeniusWordsInput"
import { toast } from "sonner"

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

interface Topic {
  id: number
  title: string
  description: string | null
  attachments: number
  tasks: number
  decisions: number
}

interface HistoryItem {
  id: number
  type: "note" | "task" | "decision"
  content: string
  timestamp: string
  details?: string
  attachmentUrl?: string
}

// ⭐ NEW: Decision interface with threading support
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
  children?: Decision[] // For nested decisions
}

interface TopicCardProps {
  topic: Topic
  topicNumber: number
  meetingId: number
  onUpdate: (updates: Partial<Topic>) => void
  onDelete: (topicId: number) => void
  onTaskClick: () => void
  onNoteClick: () => void
  onDecisionClick: () => void
  onRegisterRefresh?: (topicId: number, callback: () => void) => void
  isReadOnly?: boolean
  // ⭐ UPDATED: Include topicId in callbacks
  onEditDecision?: (decisionId: number, topicId: number) => void
  onAddThreadedDecision?: (parentDecisionId: number, topicId: number) => void
}

export default function TopicCard({ 
  topic, 
  topicNumber,
  meetingId,
  onUpdate,
  onDelete,
  onTaskClick,
  onNoteClick,
  onDecisionClick,
  onRegisterRefresh,
  isReadOnly = false,
  onEditDecision,
  onAddThreadedDecision
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
  
  const [attachments, setAttachments] = useState<TopicAttachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)

  // ⭐ NEW: Threaded decisions state
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loadingDecisions, setLoadingDecisions] = useState(false)

  // ⭐ UPDATED: 3-second debounced description for auto-save
  const debouncedDescription = useDebounce(editedDescription, 3000)

  const currentUser = getCurrentUser()
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (onRegisterRefresh) {
      onRegisterRefresh(topic.id, fetchHistory)
    }
  }, [topic.id, onRegisterRefresh])

  useEffect(() => {
    if (isExpanded) {
      fetchHistory()
      fetchAiAnalysis()
      fetchTopicAttachments()
      fetchDecisions() // ⭐ NEW
    }
  }, [topic.id, isExpanded])

  // ⭐ NEW: Auto-save description when debounced value changes
  useEffect(() => {
    // Don't save on initial load
    if (debouncedDescription === topic.description) return
    
    // Don't save if empty and original was empty
    if (!debouncedDescription && !topic.description) return
    
    // Auto-save
    handleAutoSaveDescription()
  }, [debouncedDescription])

  // Update local state when topic prop changes
  useEffect(() => {
    setEditedDescription(topic.description || "")
    setEditedTitle(topic.title)
  }, [topic.description, topic.title])

  // ⭐ NEW: Fetch decisions with threading structure
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
        // Build threaded structure
        const decisionsMap = new Map<number, Decision>()
        const rootDecisions: Decision[] = []

        // First pass: create all decision objects
        data.forEach(d => {
          decisionsMap.set(d.id, { ...d, children: [] })
        })

        // Second pass: build parent-child relationships
        data.forEach(d => {
          const decision = decisionsMap.get(d.id)!
          if (d.parent_decision_id) {
            const parent = decisionsMap.get(d.parent_decision_id)
            if (parent) {
              parent.children!.push(decision)
            } else {
              // Parent not found, treat as root
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

      const { data: notes } = await supabase
        .from('notes')
        .select('id, content, created_at')
        .eq('topic_id', topic.id)
        .order('created_at', { ascending: false })

      if (notes) {
        notes.forEach(note => {
          historyItems.push({
            id: note.id,
            type: 'note',
            content: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
            timestamp: new Date(note.created_at).toLocaleString(),
          })
        })
      }

      const { data: currentTopic } = await supabase
        .from('topics')
        .select('title, meeting_id, meetings!inner(building_id, meeting_type)')
        .eq('id', topic.id)
        .single()

      if (currentTopic) {
        const meetingInfo = currentTopic.meetings as any
        const buildingId = meetingInfo?.building_id
        const meetingType = meetingInfo?.meeting_type

        const { data: allMeetings } = await supabase
          .from('meetings')
          .select('id')
          .eq('building_id', buildingId)
          .eq('meeting_type', meetingType)

        if (allMeetings) {
          const meetingIds = allMeetings.map(m => m.id)

          const { data: allTopicsWithSameTitle } = await supabase
            .from('topics')
            .select('id')
            .in('meeting_id', meetingIds)
            .eq('title', currentTopic.title)

          if (allTopicsWithSameTitle) {
            const topicIds = allTopicsWithSameTitle.map(t => t.id)

            const { data: tasks } = await supabase
              .from('tasks')
              .select('id, description, assigned_name, assigned_email, status, created_at')
              .in('topic_id', topicIds)
              .in('status', ['open', 'in_progress'])
              .order('created_at', { ascending: false })

            if (tasks) {
              tasks.forEach(task => {
                const assignee = task.assigned_name || task.assigned_email || 'Unassigned'
                historyItems.push({
                  id: task.id,
                  type: 'task',
                  content: task.description.substring(0, 100) + (task.description.length > 100 ? '...' : ''),
                  timestamp: new Date(task.created_at).toLocaleString(),
                  details: `Assigned to: ${assignee} • Status: ${task.status}`
                })
              })
            }
          }
        }
      }

      // ⭐ REMOVED: Old decision fetching (now handled by fetchDecisions separately)

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
      const { data } = await supabase
        .from('ai_analyses')
        .select('analysis_result')
        .eq('topic_id', topic.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (data) setAiAnalysis(data.analysis_result)
    } catch (err) {
      console.error('Error fetching AI analysis:', err)
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
        alert('✅ AI Analysis complete!')
      } else {
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

  // ⭐ FIXED: Auto-save description without refreshing history
  const handleAutoSaveDescription = async () => {
    if (isReadOnly) return
    if (saving) return
    
    setSaving(true)
    await onUpdate({ description: editedDescription })
    setSaving(false)
    // ⭐ Don't refresh history on auto-save - keeps card open
    
    // Show subtle alert
    console.log('Description saved')
  }

  // ⭐ UPDATED: Save title only
  const handleSaveTitle = async () => {
    if (saving) return
    setSaving(true)
    await onUpdate({ title: editedTitle })
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

  // ⭐ NEW: Render decision with children recursively
  const renderDecision = (decision: Decision, depth: number = 0) => {
    const hasChildren = decision.children && decision.children.length > 0
    
    return (
      <div key={decision.id} className={depth > 0 ? 'ml-6 mt-2' : ''}>
        <div className="flex flex-col gap-1 rounded bg-background border border-border px-2 py-1.5 relative">
          {/* Threading indicator for nested decisions */}
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
                {new Date(decision.recorded_at).toLocaleString()}
              </span>
              {decision.edited_at && (
                <span className="text-xs text-amber-600">(Edited)</span>
              )}
            </div>
            <p className="text-sm text-foreground mb-1">{decision.motion_text}</p>
            {(decision.result || decision.votes_for !== null || decision.votes_against !== null) && (
              <p className="text-xs text-muted-foreground">
                {decision.result && `Result: ${decision.result}`}
                {(decision.votes_for !== null || decision.votes_against !== null) && ` • Votes: ${decision.votes_for || 0} for, ${decision.votes_against || 0} against`}
                {decision.votes_abstain !== null && decision.votes_abstain > 0 && `, ${decision.votes_abstain} abstain`}
              </p>
            )}
          </div>
          
          {/* ⭐ FIXED: Action Buttons with topicId */}
          {!isReadOnly && (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  console.log('Edit button clicked:', decision.id, topic.id)
                  if (onEditDecision) {
                    onEditDecision(decision.id, topic.id)
                  }
                }}
                className="flex-1 text-purple-600 border-purple-600 hover:bg-purple-50"
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
                className="flex-1 text-purple-600 border-purple-600 hover:bg-purple-50"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Threaded Decision
              </Button>
            </div>
          )}
        </div>
        
        {/* Render children recursively */}
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
      <Card className="border-0 bg-card shadow-md overflow-hidden">
        <div className="border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
              >
                <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
              </button>
              <span className="text-sm font-semibold text-muted-foreground">Topic {topicNumber}</span>
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
              <button
                onClick={() => setShowAttachments(!showAttachments)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 rounded transition-colors"
                title="View attachments"
              >
                <Paperclip className="h-4 w-4" />
                {attachments.length}
              </button>
              {!isEditingTitle && !isReadOnly && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleEditTitle}
                    className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors text-primary"
                    title="Edit title"
                  ><Edit2 className="h-4 w-4" /></button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors text-destructive"
                    title="Delete topic"
                  ><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Title Edit Buttons */}
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
            {showAttachments && (
              <div className="border-b border-border p-2 bg-muted/10">
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

            {/* ⭐ UPDATED: Always Editable Description with GeniusWords */}
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
              
              {/* AI Analysis Button */}
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
                </div>
              )}
              
              {/* AI Analysis Result */}
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

            {showDeleteConfirm && !isReadOnly && (
              <div className="px-2 py-1.5 bg-red-50 border-b border-red-200">
                <p className="text-sm text-red-800 mb-1.5">
                  Are you sure you want to delete this topic? This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setShowDeleteConfirm(false)} variant="outline" size="sm" className="flex-1">Cancel</Button>
                  <Button onClick={handleDelete} size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                    <Trash2 className="h-4 w-4 mr-2" />Delete Topic
                  </Button>
                </div>
              </div>
            )}

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

            <div className="p-2 bg-muted/20">
              <h4 className="text-sm font-semibold text-foreground mb-1.5">History by Type</h4>
              
              {/* ⭐ NEW: Decisions Section with Threading */}
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <Scale className="h-4 w-4 text-decision-purple" />
                  <span className="font-semibold text-xs uppercase">Decisions</span>
                </div>
                <div className="space-y-1">
                  {loadingDecisions && <div className="text-xs text-muted-foreground px-2">Loading...</div>}
                  {!loadingDecisions && decisions.length > 0 ? (
                    decisions.map(decision => renderDecision(decision))
                  ) : (
                    !loadingDecisions && <div className="text-xs text-muted-foreground px-2">
                      {isReadOnly 
                        ? 'No decisions yet.'
                        : 'No decisions yet. Click the button above to add one.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Tasks Section */}
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <CheckSquare className="h-4 w-4 text-task-green" />
                  <span className="font-semibold text-xs uppercase">Tasks</span>
                </div>
                <div className="space-y-1">
                  {loadingHistory && <div className="text-xs text-muted-foreground px-2">Loading...</div>}
                  {!loadingHistory && history.filter(h => h.type === "task").length > 0 ? (
                    history.filter(h => h.type === "task").map(item => (
                      <div 
                        key={item.id} 
                        className="flex flex-col gap-1 rounded bg-background border border-border px-2 py-1.5"
                      >
                        <div className="flex-1">
                          <div className="flex gap-2 items-center mb-1">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getHistoryBadgeColor(item.type)}`}>
                              {item.type.toUpperCase()}
                            </span>
                            <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                          </div>
                          <p className="text-sm text-foreground mb-1">{item.content}</p>
                          {item.details && (
                            <p className="text-xs text-muted-foreground">{item.details}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log('Clicking task:', item.id)
                            setSelectedTaskId(item.id)
                          }}
                          className="w-full text-task-green border-task-green hover:bg-task-green/10"
                        >
                          <CheckSquare className="h-3 w-3 mr-1" />
                          View Task Details
                        </Button>
                      </div>
                    ))
                  ) : (
                    !loadingHistory && <div className="text-xs text-muted-foreground px-2">
                      {isReadOnly 
                        ? 'No tasks yet.'
                        : 'No tasks yet. Click the button above to add one.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes Section */}
              <div className="mb-2 last:mb-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-note-blue" />
                  <span className="font-semibold text-xs uppercase">Notes</span>
                </div>
                <div className="space-y-1">
                  {loadingHistory && <div className="text-xs text-muted-foreground px-2">Loading...</div>}
                  {!loadingHistory && history.filter(h => h.type === "note").length > 0 ? (
                    history.filter(h => h.type === "note").map(item => (
                      <div 
                        key={item.id} 
                        className="flex flex-col gap-1 rounded bg-background border border-border px-2 py-1.5"
                      >
                        <div className="flex-1">
                          <div className="flex gap-2 items-center mb-1">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getHistoryBadgeColor(item.type)}`}>
                              {item.type.toUpperCase()}
                            </span>
                            <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                          </div>
                          <p className="text-sm text-foreground mb-1">{item.content}</p>
                          {item.details && (
                            <p className="text-xs text-muted-foreground">{item.details}</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    !loadingHistory && <div className="text-xs text-muted-foreground px-2">
                      {isReadOnly 
                        ? 'No notes yet.'
                        : 'No notes yet. Click the button above to add one.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => {
            fetchHistory()
          }}
        />
      )}
    </>
  )
}
