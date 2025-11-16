"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

interface CreateSectionModalProps {
  meetingId: string
  onClose: () => void
  onSuccess: () => void
}

export default function CreateSectionModal({ meetingId, onClose, onSuccess }: CreateSectionModalProps) {
  const [title, setTitle] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError("Section title is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Get the highest order_index for this meeting
      const { data: existingSections } = await supabase
        .from('sections')
        .select('order_index')
        .eq('meeting_id', meetingId)
        .order('order_index', { ascending: false })
        .limit(1)

      const nextOrderIndex = existingSections && existingSections.length > 0
        ? existingSections[0].order_index + 1
        : 1

      const { error: insertError } = await supabase
        .from('sections')
        .insert({
          meeting_id: parseInt(meetingId),
          title: title.trim(),
          order_index: nextOrderIndex
        })

      if (insertError) {
        console.error('Error creating section:', insertError)
        setError('Failed to create section. Please try again.')
        setSaving(false)
        return
      }

      console.log('✅ Section created successfully')
      onSuccess()
      onClose()

    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full max-w-md border-0 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <h2 className="text-xl font-bold text-foreground">Create Section</h2>
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

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Section Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Old Business, New Business, Financial Review"
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Common sections: Call to Order, Old Business, New Business, Financial Review, Adjournment
            </p>
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
              className="flex-1 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90"
              disabled={saving || !title.trim()}
            >
              {saving ? "Creating..." : "Create Section"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}