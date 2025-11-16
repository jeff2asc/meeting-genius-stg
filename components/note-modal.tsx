"use client"

import { useState } from "react"
import { X, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"

interface NoteModalProps {
  topicId: number
  onClose: () => void
  onSave?: () => void
}

export default function NoteModal({ topicId, onClose, onSave }: NoteModalProps) {
  const [content, setContent] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFileName(e.target.files[0].name)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('DEBUG - topicId:', topicId, 'Type:', typeof topicId)
    
    if (!content.trim()) {
      setError("Note content is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const currentUser = getCurrentUser()

      const insertData = {
        topic_id: topicId,
        content: content.trim(),
        created_by: currentUser.id
      }
      
      console.log('Inserting with data:', insertData)

      const { data, error: insertError } = await supabase
        .from('notes')
        .insert(insertData)
        .select()

      if (insertError) {
        console.error('Full error object:', JSON.stringify(insertError, null, 2))
        setError(`Failed to save note: ${insertError.message}`)
        setSaving(false)
        return
      }

      console.log('✅ Note saved successfully:', data)

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
      <Card className="w-full sm:max-w-md border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Note Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your note here..."
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-note-blue/50 resize-none min-h-32 disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="flex-1 bg-transparent"
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