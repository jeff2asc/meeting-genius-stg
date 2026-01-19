"use client"

import { useState, useEffect } from "react"
import { X, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import GeniusWordsInput from "./GeniusWordsInput"

// ⭐ NEW: Debounce hook for 3-second auto-save
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

interface CreateTopicModalProps {
  meetingId: string
  sectionId: number
  sectionTitle: string
  onClose: () => void
  onSuccess: () => void
}

export default function CreateTopicModal({ 
  meetingId, 
  sectionId, 
  sectionTitle, 
  onClose, 
  onSuccess 
}: CreateTopicModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [createdTopicId, setCreatedTopicId] = useState<number | null>(null)
  const [autoSaving, setAutoSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ⭐ NEW: 3-second debounced description for auto-save
  const debouncedDescription = useDebounce(description, 3000)

  // ⭐ NEW: Auto-save description when it changes (only if topic already created)
  useEffect(() => {
    if (createdTopicId && debouncedDescription !== "") {
      handleAutoSaveDescription()
    }
  }, [debouncedDescription])

  // ⭐ NEW: Auto-save description function
  const handleAutoSaveDescription = async () => {
    if (!createdTopicId) return
    if (autoSaving) return

    setAutoSaving(true)
    try {
      const { error: updateError } = await supabase
        .from("topics")
        .update({ description: description })
        .eq("id", createdTopicId)

      if (updateError) {
        console.error("Error auto-saving description:", updateError)
      } else {
        console.log("✅ Description auto-saved")
      }
    } catch (err) {
      console.error("Unexpected error during auto-save:", err)
    } finally {
      setAutoSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError("Topic title is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Get the highest order_index for this section
      const { data: existingTopics } = await supabase
        .from('topics')
        .select('order_index')
        .eq('section_id', sectionId)
        .order('order_index', { ascending: false })
        .limit(1)

      const nextOrderIndex = existingTopics && existingTopics.length > 0
        ? existingTopics[0].order_index + 1
        : 1

      const { data: newTopic, error: insertError } = await supabase
        .from('topics')
        .insert({
          meeting_id: parseInt(meetingId),
          section_id: sectionId,
          title: title.trim(),
          description: description.trim() || null,
          order_index: nextOrderIndex
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating topic:', insertError)
        setError('Failed to create topic. Please try again.')
        setSaving(false)
        return
      }

      console.log('✅ Topic created successfully')
      
      // ⭐ NEW: Save the created topic ID for auto-save
      if (newTopic) {
        setCreatedTopicId(newTopic.id)
      }

      setSaving(false)
      // ⭐ CHANGED: Don't close modal, let user continue editing

    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  // ⭐ NEW: Handle close - refresh parent if topic was created
  const handleClose = () => {
    if (createdTopicId) {
      onSuccess()
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full max-w-md border-0 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {createdTopicId ? "Edit Topic" : "Create Topic"}
            </h2>
            <p className="text-sm text-muted-foreground">Section: {sectionTitle}</p>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* ⭐ NEW: Success message when topic is created */}
          {createdTopicId && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded text-sm">
              ✅ Topic created! Continue editing or close when done.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Topic Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Budget Allocation, Roof Repair"
              required
              disabled={saving || createdTopicId !== null}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            {createdTopicId && (
              <p className="text-xs text-muted-foreground mt-1">
                Title cannot be changed after creation
              </p>
            )}
          </div>

          {/* ⭐ UPDATED: Description with GeniusWords support */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description (Optional)
            </label>
            <GeniusWordsInput
              value={description}
              onChange={setDescription}
              placeholder="Add any notes or context... (Type # for shortcuts)"
              rows={4}
              disabled={saving}
            />
            {/* ⭐ NEW: Auto-save indicator */}
            {autoSaving && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {createdTopicId && !autoSaving && (
              <p className="text-xs text-green-600 mt-2">
                💾 Description auto-saves every 3 seconds
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              className="flex-1"
              disabled={saving}
            >
              {createdTopicId ? "Done" : "Cancel"}
            </Button>
            
            {/* ⭐ CHANGED: Hide create button after topic is created */}
            {!createdTopicId && (
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90"
                disabled={saving || !title.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Topic
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
