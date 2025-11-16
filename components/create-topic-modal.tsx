"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

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
  const [error, setError] = useState<string | null>(null)

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

      const { error: insertError } = await supabase
        .from('topics')
        .insert({
          meeting_id: parseInt(meetingId),
          section_id: sectionId,
          title: title.trim(),
          description: description.trim() || null,
          order_index: nextOrderIndex
        })

      if (insertError) {
        console.error('Error creating topic:', insertError)
        setError('Failed to create topic. Please try again.')
        setSaving(false)
        return
      }

      console.log('✅ Topic created successfully')
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
          <div>
            <h2 className="text-xl font-bold text-foreground">Create Topic</h2>
            <p className="text-sm text-muted-foreground">Section: {sectionTitle}</p>
          </div>
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
              Topic Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Budget Allocation, Roof Repair"
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes or context for this topic..."
              disabled={saving}
              rows={4}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none disabled:opacity-50"
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
              className="flex-1 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90"
              disabled={saving || !title.trim()}
            >
              {saving ? "Creating..." : "Create Topic"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}