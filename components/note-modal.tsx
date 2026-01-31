"use client"

import { useState, useEffect } from "react"
import { X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"
import GeniusWordsInput from "./GeniusWordsInput"
import { toast } from "sonner"

interface NoteModalProps {
  topicId: number
  onClose: () => void
  onSave?: () => void
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
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (editMode && existingNoteId) {
      loadExistingNote()
    }
  }, [editMode, existingNoteId])

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

      setContent(noteData.content || "")
    } catch (err) {
      console.error('Error loading note:', err)
      setError('Failed to load note')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!existingNoteId || !editMode) return
    
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const { error: deleteError } = await supabase
        .from('notes')
        .delete()
        .eq('id', existingNoteId)

      if (deleteError) {
        console.error('Error deleting note:', deleteError)
        toast.error('Failed to delete note')
        setDeleting(false)
        return
      }

      toast.success('Note deleted successfully')
      
      // ⭐ FIXED: Close first, then trigger refresh
      onClose()
      
      // ⭐ FIXED: Trigger refresh after a small delay
      setTimeout(() => {
        if (onSave) {
          onSave()
        }
      }, 100)
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('An unexpected error occurred')
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
        toast.success('Note updated successfully')
      } else {
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
        toast.success('Note created successfully')
      }

      // ⭐ FIXED: Close modal first
      onClose()

      // ⭐ FIXED: Trigger refresh after closing
      setTimeout(() => {
        if (onSave) {
          onSave()
        }
      }, 100)
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
            disabled={saving || deleting}
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
            
            <div className="flex-1"></div>
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="flex-1"
              disabled={saving || deleting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-note-blue text-white hover:bg-note-blue/90"
              disabled={saving || deleting || !content.trim()}
            >
              {saving ? (editMode ? "Updating..." : "Saving...") : (editMode ? "Update Note" : "Save Note")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
