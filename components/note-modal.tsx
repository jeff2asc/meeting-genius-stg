"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"
import GeniusWordsInput from "./GeniusWordsInput"

interface NoteModalProps {
  topicId: number
  onClose: () => void
  onSave?: () => void
}

export default function NoteModal({ topicId, onClose, onSave }: NoteModalProps) {
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      if (onSave) {
        onSave()
      }

      onClose()
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full sm:max-w-2xl border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-note-blue/10 to-note-blue/5 p-6">
          <h2 className="text-xl font-bold text-foreground">Add Note</h2>
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
              {saving ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
