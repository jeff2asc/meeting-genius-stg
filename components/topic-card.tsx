"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, FileText, CheckSquare, Scale, Paperclip, Edit2, Trash2, X, Check, Sparkles, Loader2, Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import TaskDetailsModal from "./TaskDetailsModal"

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
  isReadOnly = false
}: TopicCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(topic.title)
  const [editedDescription, setEditedDescription] = useState(topic.description || "")
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [analyzingAI, setAnalyzingAI] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [showAiResult, setShowAiResult] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)

  // ← NEW: Refs for auto-save on click outside
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null)
  const editingContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (onRegisterRefresh) {
      onRegisterRefresh(topic.id, fetchHistory)
    }
  }, [topic.id, onRegisterRefresh])

  useEffect(() => {
    if (isExpanded) {
      fetchHistory()
      fetchAiAnalysis()
    }
  }, [topic.id, isExpanded])

  // ← NEW: Click outside handler
  useEffect(() => {
    if (!isEditing) return

    const handleClickOutside = (event: MouseEvent) => {
      if (editingContainerRef.current && !editingContainerRef.current.contains(event.target as Node)) {
        // Clicked outside - auto save if there are changes
        if (hasChanges && !saving) {
          handleSave()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isEditing, hasChanges, saving])

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const historyItems: HistoryItem[] = []

      // Fetch notes (only from current topic)
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

      // ============================================
      // NEW: Fetch tasks from ALL previous meetings with same topic title
      // ============================================
      
      // Step 1: Get current meeting info
      const { data: currentTopic } = await supabase
        .from('topics')
        .select('title, meeting_id, meetings!inner(building_id, meeting_type)')
        .eq('id', topic.id)
        .single()

      if (currentTopic) {
        const meetingInfo = currentTopic.meetings as any
        const buildingId = meetingInfo?.building_id
        const meetingType = meetingInfo?.meeting_type

        // Step 2: Get all meetings of same building + meeting type
        const { data: allMeetings } = await supabase
          .from('meetings')
          .select('id')
          .eq('building_id', buildingId)
          .eq('meeting_type', meetingType)

        if (allMeetings) {
          const meetingIds = allMeetings.map(m => m.id)

          // Step 3: Get all topics with same title across all these meetings
          const { data: allTopicsWithSameTitle } = await supabase
            .from('topics')
            .select('id')
            .in('meeting_id', meetingIds)
            .eq('title', currentTopic.title)

          if (allTopicsWithSameTitle) {
            const topicIds = allTopicsWithSameTitle.map(t => t.id)

            // Step 4: Get all open/in-progress tasks from these topics
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

      // Fetch decisions (only from current topic)
      const { data: decisions } = await supabase
        .from('decisions')
        .select('id, motion_text, result, votes_for, votes_against, recorded_at')
        .eq('topic_id', topic.id)
        .order('recorded_at', { ascending: false })

      if (decisions) {
        decisions.forEach(decision => {
          const voteText = decision.votes_for !== null || decision.votes_against !== null
            ? ` • Votes: ${decision.votes_for || 0} for, ${decision.votes_against || 0} against`
            : ''
          historyItems.push({
            id: decision.id,
            type: 'decision',
            content: decision.motion_text.substring(0, 100) + (decision.motion_text.length > 100 ? '...' : ''),
            timestamp: new Date(decision.recorded_at).toLocaleString(),
            details: `Result: ${decision.result || 'N/A'}${voteText}`
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
    if (!topic.description || topic.description.trim() === '') {
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
      const response = await fetch('https://rulesengine.asccreative.com/webhook/843afc5f-abe0-4bb4-bb9f-369d2657c4d0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topic.id,
          topic_title: topic.title,
          building_id: buildingId,
          building_name: buildingName,
          description: topic.description,
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
    setHasChanges(true)
  }
  
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedDescription(e.target.value)
    setHasChanges(true)
  }

  // ← NEW: Handle Enter key press
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hasChanges && !saving) {
      e.preventDefault()
      handleSave()
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    await onUpdate({ title: editedTitle, description: editedDescription })
    setHasChanges(false)
    setIsEditing(false)
    setSaving(false)
    fetchHistory()
  }

  const handleEdit = () => {
    if (isReadOnly) {
      alert('You do not have permission to edit topics.')
      return
    }
    setIsEditing(true)
    setHasChanges(false)
  }

  const handleCancel = () => {
    setEditedTitle(topic.title)
    setEditedDescription(topic.description || "")
    setIsEditing(false)
    setHasChanges(false)
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

  return (
    <>
      <Card className="border-0 bg-card shadow-md overflow-hidden" ref={editingContainerRef}>
        <div className="border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
              >
                <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
              </button>
              <span className="text-sm font-semibold text-muted-foreground">Topic {topicNumber}</span>
              {isEditing ? (
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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="h-4 w-4" />
                  {topic.attachments}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckSquare className="h-4 w-4" />
                  {topic.tasks}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Scale className="h-4 w-4" />
                  {topic.decisions}
                </div>
              </div>
              {!isEditing && !isReadOnly && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleEdit}
                    className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors text-primary"
                    title="Edit topic"
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

        {isExpanded && (
          <>
            <div className="p-4 border-b border-border">
              {isEditing ? (
                <textarea
                  ref={descriptionTextareaRef}
                  value={editedDescription}
                  onChange={handleDescriptionChange}
                  placeholder="Add description here..."
                  className="w-full min-h-32 bg-background text-foreground rounded border border-primary p-3 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  disabled={isReadOnly}
                />
              ) : (
                <>
                  <div className="min-h-32 text-foreground p-3 mb-3">
                    {topic.description || <span className="text-muted-foreground">No description yet...</span>}
                  </div>
                  {topic.description && !isEditing && !isReadOnly && (
                    <div className="flex gap-2">
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
                  {showAiResult && aiAnalysis && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        <h4 className="font-semibold text-purple-900">AI Analysis Result</h4>
                      </div>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">
                        {aiAnalysis}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {isEditing && !isReadOnly && (
              <div className="px-4 py-3 bg-muted/20 border-b border-border flex gap-2">
                <Button onClick={handleCancel} variant="outline" className="flex-1"><X className="h-4 w-4 mr-2" />Cancel</Button>
                <Button onClick={handleSave} disabled={saving || !hasChanges} className="flex-1 bg-primary hover:bg-primary/90">
                  <Check className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}

            {showDeleteConfirm && !isReadOnly && (
              <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                <p className="text-sm text-red-800 mb-3">
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
              <div className="flex gap-2 border-b border-border bg-muted/30 p-4">
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

            <div className="p-4 bg-muted/20">
              <h4 className="text-sm font-semibold text-foreground mb-2">History by Type</h4>
              {["task", "decision", "note"].map(type => (
                <div className="mb-4" key={type}>
                  <div className="flex items-center gap-2 mb-1">
                    {type === "task" && <CheckSquare className="h-4 w-4 text-task-green" />}
                    {type === "decision" && <Scale className="h-4 w-4 text-decision-purple" />}
                    {type === "note" && <FileText className="h-4 w-4 text-note-blue" />}
                    <span className="font-semibold text-xs uppercase">
                      {type === "task" ? "Tasks" : type === "decision" ? "Decisions" : "Notes"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {loadingHistory && <div className="text-xs text-muted-foreground px-2">Loading...</div>}
                    {!loadingHistory && history.filter(h => h.type === type).length > 0 ? (
                      history.filter(h => h.type === type).map(item => (
                        <div 
                          key={item.id} 
                          className="flex flex-col gap-2 rounded bg-background border border-border px-3 py-2"
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
                          {item.type === 'task' && (
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
                          )}
                        </div>
                      ))
                    ) : (
                      !loadingHistory && <div className="text-xs text-muted-foreground px-2">
                        {isReadOnly 
                          ? `No ${type}s yet.`
                          : `No ${type}s yet. Click the button above to add one.`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
