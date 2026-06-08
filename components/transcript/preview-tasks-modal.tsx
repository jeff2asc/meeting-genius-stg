"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Trash2, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { getCurrentUser } from "@/lib/supabase"

interface ExtractedTask {
  description: string
  assigned_name: string | null
  due_date: string | null
  topic_id: number | null
  confidence: number
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
                      <div className="border-t border-border bg-card p-4 space-y-3">
                        {/* Topic selector — most important field, shown first */}
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

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Task Description</Label>
                          <Textarea
                            value={task.description}
                            onChange={(e) => handleTaskChange(index, "description", e.target.value)}
                            rows={2}
                            className="resize-none text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Assigned To</Label>
                            {attendees.length > 0 ? (
                              <Select
                                value={task.assigned_name || ""}
                                onValueChange={(value) =>
                                  handleTaskChange(index, "assigned_name", value === "__none__" ? null : value)
                                }
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Not specified" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Not specified</SelectItem>
                                  {attendees.map((a) => (
                                    <SelectItem key={a.email || a.name} value={a.name}>
                                      {a.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={task.assigned_name || ""}
                                onChange={(e) =>
                                  handleTaskChange(index, "assigned_name", e.target.value || null)
                                }
                                placeholder="Not specified"
                                className="h-9 text-sm"
                              />
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Due Date</Label>
                            <Input
                              type="date"
                              value={task.due_date || ""}
                              onChange={(e) =>
                                handleTaskChange(index, "due_date", e.target.value || null)
                              }
                              className="h-9 text-sm"
                            />
                          </div>
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
