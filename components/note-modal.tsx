"use client"

import { useState, useEffect } from "react"
import { X, Trash2, Globe, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"
import GeniusWordsInput from "./GeniusWordsInput"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface NoteModalProps {
  topicId: number
  onClose: () => void
  onSave?: (topicId: number) => void
  editMode?: boolean
  existingNoteId?: number | null
  embedded?: boolean
  isOpen?: boolean
  meetingId?: string
}

type NoteVisibility = "public" | "private"

export default function NoteModal({
  topicId,
  onClose,
  onSave,
  editMode = false,
  existingNoteId = null,
  embedded = false,
  isOpen = true,
  meetingId,
}: NoteModalProps) {
  const [content, setContent] = useState("")
  const [visibility, setVisibility] = useState<NoteVisibility>("public")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (!isOpen && !embedded) return null

  useEffect(() => {
    if (editMode && existingNoteId) {
      loadExistingNote()
    }
  }, [editMode, existingNoteId])

  const loadExistingNote = async () => {
    setLoading(true)
    try {
      const { data: noteData, error: noteError } = await supabase
        .from("notes")
        .select("*")
        .eq("id", existingNoteId)
        .single()

      if (noteError || !noteData) {
        console.error("Error loading note:", noteError)
        setError("Failed to load note")
        return
      }

      setContent(noteData.content || "")
      setVisibility(
        (noteData.visibility as NoteVisibility) || "public"
      )
    } catch (err) {
      console.error("Error loading note:", err)
      setError("Failed to load note")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!existingNoteId || !editMode) return

    if (
      !confirm(
        "Are you sure you want to delete this note? This action cannot be undone."
      )
    ) {
      return
    }

    setDeleting(true)
    try {
      const { error: deleteError } = await supabase
        .from("notes")
        .delete()
        .eq("id", existingNoteId)

      if (deleteError) {
        console.error("Error deleting note:", deleteError)
        toast.error("Failed to delete note")
        setDeleting(false)
        return
      }

      toast.success("Note deleted successfully")

      setDeleting(false)

      if (embedded) {
        onClose()
        return
      }

      onClose()
      if (onSave) {
        setTimeout(() => onSave(topicId), 100)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("An unexpected error occurred")
      setDeleting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim()) {
      setError("Note content is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const currentUser = getCurrentUser()

      if (editMode && existingNoteId) {
        // UPDATE EXISTING NOTE
        const { error: updateError } = await supabase
          .from("notes")
          .update({
            content: content.trim(),
            visibility,
          })
          .eq("id", existingNoteId)

        if (updateError) {
          console.error("Error updating note:", updateError)
          setError(`Failed to update note: ${updateError.message}`)
          setSaving(false)
          return
        }

        toast.success("Note updated successfully")
        setSaving(false)

        if (embedded) {
          if (onSave) onSave(topicId)
          onClose()
          return
        }

        onClose()
        if (onSave) {
          setTimeout(() => onSave(topicId), 100)
        }
      } else {
        // CREATE NEW NOTE
        const now = new Date().toISOString()

        const { error: insertError } = await supabase.from("notes").insert({
          topic_id: topicId,
          content: content.trim(),
          created_by: currentUser?.id,
          visibility,
          created_at: now
        })

        if (insertError) {
          console.error("Error inserting note:", insertError)
          setError(`Failed to save note: ${insertError.message}`)
          setSaving(false)
          return
        }

        toast.success("Note created successfully")

        setSaving(false)
        setContent("")
        setError(null)
        setVisibility("public")

        if (embedded) {
          if (onSave) onSave(topicId)
          onClose()
          return
        }

        onClose()
        if (onSave) {
          setTimeout(() => onSave(topicId), 100)
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div
        className={
          embedded
            ? "p-6"
            : "fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        }
      >
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Loading note...</span>
          </div>
        </Card>
      </div>
    )
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Note Content *
        </label>
        <GeniusWordsInput
          value={content}
          onChange={setContent}
          placeholder="Enter note content... (Type # for shortcuts)"
          rows={6}
          disabled={saving || deleting}
        />
      </div>

      <div className="space-y-1 pt-2">
        <label className="block text-sm font-medium text-foreground">
          Visibility
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          Private notes are only visible to you, property managers, corporate
          admins, and master users.
        </p>
        <Select
          value={visibility}
          onValueChange={(value: NoteVisibility) => setVisibility(value)}
          disabled={saving || deleting}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-note-blue" />
                <span>Public Note</span>
                <span className="text-[10px] text-muted-foreground font-normal">(Visible to everyone)</span>
              </span>
            </SelectItem>
            <SelectItem value="private">
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-600" />
                <span>Private Note</span>
                <span className="text-[10px] text-muted-foreground font-normal">(Restricted access)</span>
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3 pt-4">
        {editMode && existingNoteId && (
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="text-red-600 border-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        )}

        <div className="flex-1" />

        {!embedded && (
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={saving || deleting}
          >
            Cancel
          </Button>
        )}

        <Button
          type="submit"
          className="flex-1 bg-note-blue text-white hover:bg-note-blue/90"
          disabled={saving || deleting || !content.trim()}
        >
          {saving
            ? editMode
              ? "Updating..."
              : "Saving..."
            : editMode
              ? "Update Note"
              : "Save Note"}
        </Button>
      </div>
    </form>
  )

  if (embedded) {
    return formContent
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full sm:max-w-2xl border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-note-blue/10 to-note-blue/5 p-6">
          <h2 className="text-xl font-bold text-foreground">
            {editMode ? "Edit Note" : "Add Note"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
            disabled={saving || deleting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {formContent}
      </Card>
    </div>
  )
}
