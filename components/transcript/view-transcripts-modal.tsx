"use client"

import { useState, useEffect } from "react"
import { FileText, Download, Edit2, Check, X, Loader2, Save, RefreshCw, Music } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { toast } from "sonner"

interface Transcript {
  id: number
  filename: string
  file_url: string
  created_at: string
  transcript_content?: string
}

interface Recording {
  audio_filename: string
  audio_file: { url: string; path: string }
  audio_duration: number
  recording_ended_at: string
}

interface ViewTranscriptsModalProps {
  isOpen: boolean
  meetingId: number
  onClose: () => void
}

export function ViewTranscriptsModal({ isOpen, meetingId, onClose }: ViewTranscriptsModalProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [meetingRecording, setMeetingRecording] = useState<Recording | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const currentUser = getCurrentUser()

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [meetingId, isOpen])

  if (!isOpen) return null

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch meeting info
      const { data: meetingData, error: mError } = await supabase
        .from("meetings")
        .select("audio_filename, audio_file, audio_duration, recording_ended_at, meeting_transcript")
        .eq("id", meetingId)
        .single()

      // 2. Fetch transcripts from table
      const { data: dbTranscripts, error: tError } = await supabase
        .from("meeting_transcripts")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false })

      if (tError) throw tError

      // Combine with direct transcript from meetings table
      const allTranscripts = [
        ...(meetingData?.meeting_transcript ? [{
           id: 'main',
           filename: 'Main Transcript',
           transcript_text: meetingData.meeting_transcript,
           created_at: meetingData.recording_ended_at || new Date().toISOString()
        }] : []),
        ...(dbTranscripts || [])
      ]

      // Fetch content for each transcript
      const transcriptsWithContent = await Promise.all(allTranscripts.map(async (t: any) => {
        // ⭐ NEW: If the text is already in the row, use it!
        if (t.transcript_text) {
          return { ...t, transcript_content: t.transcript_text }
        }
        
        // Old way: fetch from file_url
        if (t.file_url && t.file_url !== 'internal') {
          try {
            const res = await fetch(t.file_url)
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

  const handleManualTranscribe = async () => {
    if (!meetingRecording || !meetingRecording.audio_file?.url) {
      toast.error("No recording found to transcribe")
      return
    }

    setTranscribing(true)
    const documentedSecret = process.env.NEXT_PUBLIC_API_KEY || ""

    try {
      const transRes = await fetch("/api/transcripts/transcribe-recording", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": documentedSecret
        },
        body: JSON.stringify({
          meeting_id: String(meetingId),
          audio_url: meetingRecording.audio_file.url,
          user_id: currentUser?.id,
          mime_type: "audio/webm"
        })
      })

      const resData = await transRes.json()
      
      if (!transRes.ok) {
        throw new Error(resData.error || "Transcription failed")
      }

      toast.success("AI Transcript generated successfully!")
      fetchData() // Refresh list
    } catch (err: any) {
      console.error("Manual transcription error:", err)
      toast.error(`Transcription failed: ${err.message}`)
    } finally {
      setTranscribing(false)
    }
  }

  const handleEdit = (transcript: Transcript) => {
    setEditingId(transcript.id as number | string)
    setEditContent(transcript.transcript_content || "")
  }

  const handleSave = async (id: number | string) => {
    setSaving(true)
    try {
      const transcript = transcripts.find(t => t.id === id)
      if (!transcript) return

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
          meeting_id: meetingId, // needed for 'main' transcript
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
    const file = new Blob([transcript.transcript_content || ""], {type: 'text/plain'})
    element.href = URL.createObjectURL(file)
    element.download = transcript.filename
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const showRetryButton = meetingRecording && transcripts.length === 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl shadow-2xl border-border/50 bg-card/95">
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground">Meeting Transcripts</h2>
              <p className="text-xs text-muted-foreground italic">AI-generated records from Gemini 1.5 Flash</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground animate-pulse">Fetching transcripts from the vault...</p>
            </div>
          ) : transcripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative mb-6">
                 <FileText className="h-20 w-20 text-muted-foreground/10" />
                 {meetingRecording && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Music className="h-8 w-8 text-primary/40 animate-pulse" />
                    </div>
                 )}
              </div>
              
              <h3 className="text-xl font-black text-foreground mb-2">
                {meetingRecording ? "Recording Found, No Transcript" : "No Transcripts Yet"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-8">
                {meetingRecording 
                  ? "We found a meeting recording but the AI transcript hasn't been generated yet. You can try generating it now."
                  : "Record some audio during the meeting to generate AI transcripts."}
              </p>

              {meetingRecording && (
                <Button 
                    onClick={handleManualTranscribe} 
                    disabled={transcribing}
                    className="bg-primary hover:bg-primary/90 text-white rounded-2xl px-8 py-6 h-auto shadow-lg shadow-primary/20 gap-3 group"
                >
                    {transcribing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <RefreshCw className="h-5 w-5 group-hover:rotate-180 transition-transform duration-500" />
                    )}
                    <div className="text-left">
                        <div className="font-bold">Generate AI Transcript</div>
                        <div className="text-[10px] opacity-70">Using Gemini 1.5 Flash</div>
                    </div>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {transcripts.map((t) => (
                <div key={t.id} className="group relative">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="bg-primary/10 text-primary font-black text-[10px] uppercase">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Save className="h-3.5 w-3.5 mr-2" />}
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

function Badge({ children, className, variant = "secondary" }: any) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>
      {children}
    </span>
  )
}
