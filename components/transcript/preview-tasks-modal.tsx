"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Trash2, Edit2, Save, X, Loader2, AlertCircle } from "lucide-react"
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

interface PreviewTasksModalProps {
  isOpen: boolean
  onClose: () => void
  transcriptId: number
  extractedTasks: ExtractedTask[]
  sections: Section[]
  onTasksCreated: () => void
}

export function PreviewTasksModal({
  isOpen,
  onClose,
  transcriptId,
  extractedTasks,
  sections,
  onTasksCreated,
}: PreviewTasksModalProps) {
  const [tasks, setTasks] = useState<ExtractedTask[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    setTasks([...extractedTasks])
  }, [extractedTasks])

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index))
  }

  const handleEditTask = (index: number) => {
    setEditingIndex(index)
  }

  const handleSaveTask = (index: number) => {
    setEditingIndex(null)
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
  }

  const handleTaskChange = (index: number, field: keyof ExtractedTask, value: any) => {
    const updatedTasks = [...tasks]
    updatedTasks[index] = {
      ...updatedTasks[index],
      [field]: value,
    }
    setTasks(updatedTasks)
  }

  const handleApprove = async () => {
    if (tasks.length === 0) {
      toast.error("No tasks to create")
      return
    }

    // Validate that all tasks have topic_id
    const invalidTasks = tasks.filter((task) => !task.topic_id)
    if (invalidTasks.length > 0) {
      toast.error("Please assign all tasks to a topic before approving")
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript_id: transcriptId,
          tasks: tasks,
          user_id: currentUser.id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create tasks")
      }

      toast.success(result.message || "Tasks created successfully!")
      onTasksCreated()
      onClose()
    } catch (error: any) {
      console.error("Create tasks error:", error)
      toast.error(error.message || "Failed to create tasks")
    } finally {
      setIsCreating(false)
    }
  }

  const getTopicById = (topicId: number | null) => {
    if (!topicId) return null
    for (const section of sections) {
      const topic = section.topics.find((t) => t.id === topicId)
      if (topic) return { topic, section }
    }
    return null
  }

  const handleClose = () => {
    if (!isCreating) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Review Extracted Tasks from Transcript
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No tasks found</p>
              <p className="text-sm text-muted-foreground">
                The transcript did not contain any recognizable action items or tasks.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>{tasks.length}</strong> task(s) will be created
                </p>
              </div>

              <div className="space-y-3">
                {tasks.map((task, index) => {
                  const topicInfo = getTopicById(task.topic_id)
                  const isEditing = editingIndex === index

                  return (
                    <div
                      key={index}
                      className="border rounded-lg p-4 space-y-3 bg-card hover:shadow-md transition-shadow"
                    >
                      {isEditing ? (
                        // Edit Mode
                        <>
                          <div className="space-y-2">
                            <Label>Task Description</Label>
                            <Textarea
                              value={task.description}
                              onChange={(e) =>
                                handleTaskChange(index, "description", e.target.value)
                              }
                              rows={3}
                              className="resize-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Assigned To (Name)</Label>
                              <Input
                                value={task.assigned_name || ""}
                                onChange={(e) =>
                                  handleTaskChange(index, "assigned_name", e.target.value || null)
                                }
                                placeholder="Not specified"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Due Date</Label>
                              <Input
                                type="date"
                                value={task.due_date || ""}
                                onChange={(e) =>
                                  handleTaskChange(index, "due_date", e.target.value || null)
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Assign to Topic</Label>
                            <Select
                              value={task.topic_id?.toString() || ""}
                              onValueChange={(value) =>
                                handleTaskChange(index, "topic_id", parseInt(value))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a topic" />
                              </SelectTrigger>
                              <SelectContent>
                                {sections.map((section) => (
                                  <div key={section.id}>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
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
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveTask(index)}
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                          </div>
                        </>
                      ) : (
                        // View Mode
                        <>
                          <div>
                            <p className="font-medium">{task.description}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Assigned:</span>{" "}
                              <span className="font-medium">
                                {task.assigned_name || (
                                  <span className="text-muted-foreground italic">
                                    Not specified
                                  </span>
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Due Date:</span>{" "}
                              <span className="font-medium">
                                {task.due_date || (
                                  <span className="text-muted-foreground italic">
                                    Not specified
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="text-sm">
                            <span className="text-muted-foreground">Topic:</span>{" "}
                            {topicInfo ? (
                              <span className="font-medium">
                                {topicInfo.section.title} → {topicInfo.topic.title}
                              </span>
                            ) : (
                              <span className="text-red-500 font-medium">
                                ⚠️ No topic assigned
                              </span>
                            )}
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditTask(index)}
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveTask(index)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={tasks.length === 0 || isCreating}
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
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
