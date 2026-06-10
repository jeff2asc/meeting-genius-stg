"use client"

import React, { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Trash2, Loader2, AlertCircle, ChevronDown, ChevronUp, X, Plus, Paperclip, Upload } from "lucide-react"
import { toast } from "sonner"
import { getCurrentUser } from "@/lib/supabase"

interface ExtractedTask {
  description: string
  assigned_name: string | null
  assigned_email?: string | null
  due_date: string | null
  topic_id: number | null
  confidence: number
  assignees?: Array<{ name: string; email: string }>
  attachments?: Array<{ filename: string; file?: File; file_size: number; mime_type: string }>
}

interface Section {
  id: number
  title: string
  topics: Topic[]
}

interface Topic {
  id: number
  title: string
}

interface Attendee {
  name: string
  email?: string
}

interface PreviewTasksModalProps {
  isOpen: boolean
  onClose: () => void
  transcriptId: number | null
  extractedTasks: ExtractedTask[]
  sections: Section[]
  attendees?: Attendee[]
  onTasksCreated: () => void
}

export function PreviewTasksModal({
  isOpen,
  onClose,
  transcriptId,
  extractedTasks,
  sections,
  attendees = [],
  onTasksCreated,
}: PreviewTasksModalProps) {
  const [tasks, setTasks] = useState<ExtractedTask[]>([])
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  // Per-task manual assignee input state
  const [newAssigneeName, setNewAssigneeName] = useState<Record<number, string>>({})
  const [newAssigneeEmail, setNewAssigneeEmail] = useState<Record<number, string>>({})
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  // Fixed: only depend on extractedTasks (stable array ref), not sections
  // sections is used for rendering only — not needed in deps
  useEffect(() => {
    setTasks(extractedTasks.map(t => ({ ...t })))
    setExpandedIndex(null)
  }, [extractedTasks]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemoveTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index))
    if (expandedIndex === index) setExpandedIndex(null)
  }

  const handleTaskChange = (index: number, field: keyof ExtractedTask, value: any) => {
    setTasks(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const allTopics = sections.flatMap(s => s.topics)

  const handleAddManualAssignee = (index: number) => {
    const name = (newAssigneeName[index] || "").trim()
    const email = (newAssigneeEmail[index] || "").trim()
    if (!name || !email) return
    setTasks(prev => {
      const updated = [...prev]
      const task = { ...updated[index] }
      const existing = task.assignees || []
      if (existing.some(a => a.email.toLowerCase() === email.toLowerCase())) return prev
      task.assignees = [...existing, { name, email }]
      updated[index] = task
      return updated
    })
    setNewAssigneeName(p => ({ ...p, [index]: "" }))
    setNewAssigneeEmail(p => ({ ...p, [index]: "" }))
  }

  const handleAddFromAttendees = (index: number, attendee: Attendee) => {
    setTasks(prev => {
      const updated = [...prev]
      const task = { ...updated[index] }
      const existing = task.assignees || []
      if (existing.some(a => a.email?.toLowerCase() === attendee.email?.toLowerCase())) return prev
      task.assignees = [...existing, { name: attendee.name, email: attendee.email || "" }]
      updated[index] = task
      return updated
    })
  }

  const handleRemoveAssignee = (taskIndex: number, email: string) => {
    setTasks(prev => {
      const updated = [...prev]
      const task = { ...updated[taskIndex] }
      task.assignees = (task.assignees || []).filter(a => a.email !== email)
      updated[taskIndex] = task
      return updated
    })
  }

  const handleFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return }
    setTasks(prev => {
      const updated = [...prev]
      const task = { ...updated[index] }
      task.attachments = [...(task.attachments || []), { filename: file.name, file, file_size: file.size, mime_type: file.type }]
      updated[index] = task
      return updated
    })
    e.target.value = ""
  }

  const handleRemoveAttachment = (taskIndex: number, attIndex: number) => {
    setTasks(prev => {
      const updated = [...prev]
      const task = { ...updated[taskIndex] }
      task.attachments = (task.attachments || []).filter((_, i) => i !== attIndex)
      updated[taskIndex] = task
      return updated
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const getTopicLabel = (topicId: number | null): string => {
    if (!topicId) return ""
    for (const section of sections) {
      const topic = section.topics.find(t => t.id === topicId)
      if (topic) return `${section.title} → ${topic.title}`
    }
    return ""
  }

  const unassignedCount = tasks.filter(t => !t.topic_id).length
  const canApprove = tasks.length > 0 && unassignedCount === 0

  const handleApprove = async () => {
    if (tasks.length === 0) {
      toast.error("No tasks to create")
      return
    }
    if (unassignedCount > 0) {
      toast.error(`Please assign a topic to all ${unassignedCount} task(s) before approving`)
      return
    }

    const currentUser = getCurrentUser()
    if (!currentUser) {
      toast.error("You must be logged in to create tasks")
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch("/api/transcripts/create-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript_id: transcriptId,
          tasks,
          user_id: currentUser.id,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to create tasks")

      toast.success(result.message || `${result.created_count || tasks.length} task(s) created! View them under the assigned topics in the meeting.`)
      onTasksCreated()
      onClose()
    } catch (error: any) {
      console.error("Create tasks error:", error)
      toast.error(error.message || "Failed to create tasks")
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    if (!isCreating) onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Review Extracted Tasks
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info banner */}
          {tasks.length > 0 && (
            <div className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
              canApprove
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}>
              <span>
                <strong>{tasks.length}</strong> task(s) found
                {unassignedCount > 0 && (
                  <> — <strong>{unassignedCount}</strong> still need a topic assigned</>
                )}
              </span>
              {canApprove && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            </div>
          )}

          {/* Info hint */}
          {tasks.length > 0 && (
            <p className="text-xs text-muted-foreground">
              💡 Tasks will appear under the topic you assign them to in the meeting view.
            </p>
          )}

          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No tasks found</p>
              <p className="text-sm text-muted-foreground">
                The transcript did not contain any recognizable action items.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, index) => {
                const isExpanded = expandedIndex === index
                const hasTopicAssigned = !!task.topic_id

                return (
                  <div
                    key={index}
                    className={`border rounded-lg overflow-hidden transition-all ${
                      hasTopicAssigned ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/30"
                    }`}
                  >
                    {/* Task header — always visible */}
                    <div className="flex items-start gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {task.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                          {task.assigned_name && (
                            <span className="text-xs text-muted-foreground">
                              👤 {task.assigned_name}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground">
                              📅 {task.due_date}
                            </span>
                          )}
                          {hasTopicAssigned ? (
                            <span className="text-xs text-green-700 font-medium">
                              ✅ {getTopicLabel(task.topic_id)}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium">
                              ⚠️ No topic assigned — click to assign
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setExpandedIndex(isExpanded ? null : index)}
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {isExpanded ? "Done" : "Edit"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => handleRemoveTask(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded edit panel */}
                    {isExpanded && (
                      <div className="border-t border-border bg-card p-4 space-y-4">
                        {/* Topic selector */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">
                            Assign to Topic <span className="text-red-500">*</span>
                          </Label>
                          {allTopics.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">
                              No topics available — add topics to the meeting first.
                            </p>
                          ) : (
                            <Select
                              value={task.topic_id?.toString() || ""}
                              onValueChange={(value) =>
                                handleTaskChange(index, "topic_id", parseInt(value))
                              }
                            >
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select a topic…" />
                              </SelectTrigger>
                              <SelectContent>
                                {sections.map((section) => (
                                  <div key={section.id}>
                                    <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                                      {section.title}
                                    </div>
                                    {section.topics.map((topic) => (
                                      <SelectItem key={topic.id} value={topic.id.toString()}>
                                        {topic.title}
                                      </SelectItem>
                                    ))}
                                  </div>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {/* Task Description */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Task Description</Label>
                          <Textarea
                            value={task.description}
                            onChange={(e) => handleTaskChange(index, "description", e.target.value)}
                            rows={3}
                            className="resize-none text-sm"
                            placeholder="Enter task description..."
                          />
                        </div>

                        {/* Attachments */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold flex items-center gap-1.5">
                            <Paperclip className="h-3.5 w-3.5" />
                            Attachments ({(task.attachments || []).length})
                          </Label>
                          <div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRefs.current[index]?.click()}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload File
                            </Button>
                            <input
                              ref={(el) => { fileInputRefs.current[index] = el }}
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                              onChange={(e) => handleFileUpload(index, e)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Supported: PDF, DOC, DOCX, TXT, Images (Max 10MB)
                            </p>
                          </div>
                          {(task.attachments || []).length > 0 && (
                            <div className="space-y-1 border border-border rounded-lg p-2 bg-muted/10">
                              {(task.attachments || []).map((att, attIdx) => (
                                <div key={attIdx} className="flex items-center justify-between bg-background border border-border rounded-lg p-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-xs truncate">{att.filename}</div>
                                      <div className="text-xs text-muted-foreground">{formatFileSize(att.file_size)}</div>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveAttachment(index, attIdx)}
                                    className="text-destructive hover:text-destructive h-7 w-7 p-0"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Assignees */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Assignees *</Label>

                          {/* Current assignees */}
                          {(task.assignees || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200 mb-2">
                              {(task.assignees || []).map((assignee, aIdx) => (
                                <div key={aIdx} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-xs border border-blue-300">
                                  <span className="font-medium">{assignee.name}</span>
                                  {assignee.email && <span className="opacity-70">({assignee.email})</span>}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAssignee(index, assignee.email)}
                                    className="hover:bg-blue-200 rounded-full p-0.5 ml-0.5"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Add Manually */}
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-foreground">Add Manually</div>
                              <input
                                type="text"
                                placeholder="Name"
                                value={newAssigneeName[index] || ""}
                                onChange={(e) => setNewAssigneeName(p => ({ ...p, [index]: e.target.value }))}
                                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                              <input
                                type="email"
                                placeholder="Email"
                                value={newAssigneeEmail[index] || ""}
                                onChange={(e) => setNewAssigneeEmail(p => ({ ...p, [index]: e.target.value }))}
                                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                              <Button
                                type="button"
                                onClick={() => handleAddManualAssignee(index)}
                                disabled={!(newAssigneeName[index] || "").trim() || !(newAssigneeEmail[index] || "").trim()}
                                className="w-full bg-primary hover:bg-primary/90 text-sm"
                                size="sm"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </Button>
                            </div>

                            {/* Select from Attendees */}
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-foreground">
                                Select from Attendees {attendees.length > 0 && `(${attendees.length})`}
                              </div>
                              {attendees.length > 0 ? (
                                <div className="border border-border rounded-lg p-2 bg-muted/20 max-h-[160px] overflow-y-auto space-y-1">
                                  {attendees.map((attendee, aIdx) => {
                                    const isAssigned = (task.assignees || []).some(a => a.email === attendee.email || a.name === attendee.name)
                                    return (
                                      <button
                                        key={aIdx}
                                        type="button"
                                        onClick={() => handleAddFromAttendees(index, attendee)}
                                        disabled={isAssigned}
                                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-muted transition-colors ${isAssigned ? "opacity-50 cursor-not-allowed bg-green-50" : ""}`}
                                      >
                                        <div className="font-medium">{attendee.name}</div>
                                        {attendee.email && <div className="text-xs text-muted-foreground">{attendee.email}</div>}
                                        {isAssigned && <div className="text-xs text-green-600 font-medium">✓ Already assigned</div>}
                                      </button>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div className="border border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">
                                  No attendees added to this meeting
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Due Date */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Due Date</Label>
                          <Input
                            type="date"
                            value={task.due_date || ""}
                            onChange={(e) => handleTaskChange(index, "due_date", e.target.value || null)}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={!canApprove || isCreating}
            className={canApprove ? "" : "opacity-60 cursor-not-allowed"}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Tasks...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve & Create Tasks
                {unassignedCount > 0 && ` (${unassignedCount} unassigned)`}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
