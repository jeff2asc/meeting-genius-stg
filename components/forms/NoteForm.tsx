"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { supabase, getCurrentUser } from "@/lib/supabase"
import GeniusWordsInput from "../GeniusWordsInput"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface NoteFormProps {
  topicId: number
  onSave?: () => void
}

export default function NoteForm({ topicId, onSave }: NoteFormProps) {
  const [content, setContent] = useState("")
  const [visibility, setVisibility] = useState<"public" | "private">("public")
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
          created_by: currentUser?.id,
          visibility: visibility
        })

      if (insertError) {
        console.error('Error inserting note:', insertError)
        setError(`Failed to save note: ${insertError.message}`)
        setSaving(false)
        return
      }

      console.log('✅ Note saved successfully')
      toast.success('Note created successfully')

      // ⭐ Clear form after success
      setContent("")
      setVisibility("public")
      setError(null)

      // ⭐ Trigger refresh
      if (onSave) {
        onSave()
      }

      setSaving(false)
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  return (
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
          disabled={saving}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          Visibility
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          Private notes are only visible to creators and management.
        </p>
        <Select
          value={visibility}
          onValueChange={(value: "public" | "private") => setVisibility(value)}
          disabled={saving}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">
              <span className="flex items-center gap-2">
                <span>Public Note</span>
                <span className="text-[10px] text-muted-foreground font-normal">(Visible to everyone)</span>
              </span>
            </SelectItem>
            <SelectItem value="private">
              <span className="flex items-center gap-2">
                <span>Private Note</span>
                <span className="text-[10px] text-muted-foreground font-normal">(Restricted access)</span>
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          className="w-full bg-note-blue text-white hover:bg-note-blue/90"
          disabled={saving || !content.trim()}
        >
          {saving ? "Saving..." : "Save Note"}
        </Button>
      </div>
    </form>
  )
}
