"use client"

import { useState, useEffect } from "react"
import { FileText, Download, Edit2, X, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"

interface Transcript {
  id: number | string
  filename: string
  file_url: string
  created_at: string
  transcript_content?: string
}

interface ViewTranscriptsModalProps {
  isOpen: boolean
  meetingId: number
  onClose: () => void
}

export function ViewTranscriptsModal({ isOpen, meetingId, onClose }: ViewTranscriptsModalProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [meetingId, isOpen])

  if (!isOpen) return null

  const fetchData = async () => {
    setLoading(true)
    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || ""

      // 1. Fetch meeting info via server API (bypasses RLS)
      const meetingRes = await fetch(`/api/v1/meetings/${meetingId}`, {
        headers: { "x-api-key": apiKey }
      })
      const meetingJson = meetingRes.ok ? await meetingRes.json() : null
      const meetingData = meetingJson?.data || null

      // 2. Fetch transcripts from table via server API
      const transcriptRes = await fetch(`/api/transcripts/list?meeting_id=${meetingId}`, {
        headers: { "x-api-key": apiKey }
      })
      const transcriptJson = transcriptRes.ok ? await transcriptRes.json() : {}
      const dbTranscripts = transcriptJson?.transcripts || []

      // Combine with direct transcript from meetings table
      const allTranscripts = [
        ...(meetingData?.meeting_transcript ? [{
          id: 'main',
          filename: 'Main Transcript',
          transcript_text: meetingData.meeting_transcript,
          created_at: meetingData.recording_ended_at || new Date().toISOString()
        }] : []),
        ...(Array.isArray(dbTranscripts) ? dbTranscripts : (dbTranscripts?.transcripts || []))
      ]

      // Map transcript_text to transcript_content for display.
      // Prefer transcript_text (DB column) over file_url to avoid CDN cache
      // serving stale content after an edit.
      const transcriptsWithContent = await Promise.all(allTranscripts.map(async (t: any) => {
        if (t.transcript_text) {
          return { ...t, transcript_content: t.transcript_text }
        }
        // Fall back to fetching from file_url only when transcript_text is absent.
        // Append a cache-busting param so the CDN doesn't serve stale content.
        if (t.file_url && t.file_url !== 'internal') {
          try {
            const res = await fetch(`${t.file_url}?t=${Date.now()}`)
            if (res.ok) {
              const content = await res.text()
              return { ...t, transcript_content: content }
            }
          } catch (e) {
            console.error("Error fetching content for transcript", t.id, e)
          }
        }
        return t
      }))

      setTranscripts(transcriptsWithContent)
    } catch (err: any) {
      console.error("Error fetching transcripts:", err)
      toast.error("Failed to load transcripts")
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (transcript: Transcript) => {
    setEditingId(transcript.id)
    setEditContent(transcript.transcript_content || "")
  }

  const handleSave = async (id: number | string) => {
    setSaving(true)
    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || ""
      const res = await fetch("/api/transcripts/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          transcript_id: id,
          content: editContent,
          meeting_id: meetingId,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Save failed")
      }

      setTranscripts(prev => prev.map(t =>
        t.id === id ? { ...t, transcript_content: editContent } : t
      ))

      setEditingId(null)
      toast.success("Transcript updated")
    } catch (err: any) {
      console.error("Error saving transcript:", err)
      toast.error("Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = (transcript: Transcript) => {
    const element = document.createElement("a")
    const file = new Blob([transcript.transcript_content || ""], { type: "text/plain" })
    element.href = URL.createObjectURL(file)
    element.download = transcript.filename
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl shadow-2xl border-border/50 bg-card/95">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground">Meeting Transcripts</h2>
              <p className="text-xs text-muted-foreground italic">Live-captured speech records</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground animate-pulse">Loading transcripts...</p>
            </div>
          ) : transcripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="h-20 w-20 text-muted-foreground/10 mb-6" />
              <h3 className="text-xl font-black text-foreground mb-2">No Transcripts Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Start a recording during the meeting — the live transcript will appear here automatically when you stop.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {transcripts.map((t) => (
                <div key={t.id} className="group relative">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary/10 text-primary font-black text-[10px] uppercase">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Badge>
                      <span className="text-xs font-medium text-muted-foreground truncate max-w-[200px]">
                        {t.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-2 text-xs"
                        onClick={() => handleDownload(t)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                      {editingId !== t.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-2 text-xs text-primary"
                          onClick={() => handleEdit(t)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    {editingId === t.id ? (
                      <div className="space-y-3">
                        <textarea
                          className="w-full min-h-[200px] p-4 bg-background border-2 border-primary/20 rounded-2xl text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none font-sans leading-relaxed"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          placeholder="Edit your transcript here..."
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleSave(t.id)} disabled={saving}>
                            {saving
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                              : <Save className="h-3.5 w-3.5 mr-2" />
                            }
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 bg-muted/40 rounded-2xl border border-border/50 text-sm leading-relaxed text-foreground/80 hover:bg-muted/60 transition-colors whitespace-pre-wrap">
                        {t.transcript_content || "Empty transcript"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  )
}
