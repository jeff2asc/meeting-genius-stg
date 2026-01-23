"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"
import GeniusWordsInput from "./GeniusWordsInput"

interface NoteModalProps {
  topicId: number
  onClose: () => void
  onSave?: () => void
  // ⭐ NEW: Edit mode props
  editMode?: boolean
  existingNoteId?: number | null
}

export default function NoteModal({ 
  topicId, 
  onClose, 
  onSave,
  editMode = false,
  existingNoteId = null
}: NoteModalProps) {
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ⭐ NEW: Load existing note data in edit mode
  useEffect(() => {
    if (editMode && existingNoteId) {
      loadExistingNote()
    }
  }, [editMode, existingNoteId])

  // ⭐ NEW: Load existing note for editing
  const loadExistingNote = async () => {
    setLoading(true)
    try {
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', existingNoteId)
        .single()

      if (noteError || !noteData) {
        console.error('Error loading note:', noteError)
        setError('Failed to load note')
        return
      }

      // Populate form
      setContent(noteData.content || "")
    } catch (err) {
      console.error('Error loading note:', err)
      setError('Failed to load note')
    } finally {
      setLoading(false)
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

      // ⭐ UPDATED: Handle both create and edit
      if (editMode && existingNoteId) {
        // UPDATE existing note
        const { error: updateError } = await supabase
          .from('notes')
          .update({
            content: content.trim(),
          })
          .eq('id', existingNoteId)

        if (updateError) {
          console.error('Error updating note:', updateError)
          setError(`Failed to update note: ${updateError.message}`)
          setSaving(false)
          return
        }

        console.log('✅ Note updated successfully')
      } else {
        // CREATE new note
        const { error: insertError } = await supabase
          .from('notes')
          .insert({
            topic_id: topicId,
            content: content.trim(),
            created_by: currentUser?.id
          })

        if (insertError) {
          console.error('Error inserting note:', insertError)
          setError(`Failed to save note: ${insertError.message}`)
          setSaving(false)
          return
        }

        console.log('✅ Note saved successfully')
      }

      // ⭐ FIXED: Call onSave BEFORE closing to trigger refresh
      if (onSave) {
        onSave()
      }

      // ⭐ FIXED: Small delay to ensure refresh completes
      await new Promise(resolve => setTimeout(resolve, 100))

      onClose()
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Loading note...</span>
          </div>
        </Card>
      </div>
    )
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

          {/* ⭐ UPDATED: Note Content with GeniusWords */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Note Content *
            </label>
            <GeniusWordsInput
              value={content}
              onChange={setContent}
              placeholder="Enter note content... (Type # for shortcuts)"
              rows={6}
              disabled={saving}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-note-blue text-white hover:bg-note-blue/90"
              disabled={saving || !content.trim()}
            >
              {saving ? (editMode ? "Updating..." : "Saving...") : (editMode ? "Update Note" : "Save Note")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
