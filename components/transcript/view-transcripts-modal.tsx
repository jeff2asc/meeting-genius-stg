"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, Download, Eye, Loader2, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface Transcript {
  id: number
  meeting_id: number
  filename: string
  file_url: string
  file_size: number
  mime_type: string
  tasks_created_count: number
  uploaded_by: number | null
  created_at: string
  users?: {
    name: string
  }
}

interface ViewTranscriptsModalProps {
  isOpen: boolean
  onClose: () => void
  meetingId: number
}

export function ViewTranscriptsModal({
  isOpen,
  onClose,
  meetingId,
}: ViewTranscriptsModalProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && meetingId) {
      fetchTranscripts()
    }
  }, [isOpen, meetingId])

  const fetchTranscripts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/transcripts/list?meeting_id=${meetingId}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch transcripts")
      }

      setTranscripts(result.transcripts || [])
    } catch (error: any) {
      console.error("Error fetching transcripts:", error)
      toast.error(error.message || "Failed to load transcripts")
    } finally {
      setLoading(false)
    }
  }

  const handleViewFile = (fileUrl: string) => {
    window.open(fileUrl, "_blank")
  }

  const handleDownload = (fileUrl: string, filename: string) => {
    const link = document.createElement("a")
    link.href = fileUrl
    link.download = filename
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a")
    } catch {
      return dateString
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Uploaded Transcripts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transcripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No transcripts found</p>
              <p className="text-sm text-muted-foreground">
                Upload a transcript to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transcripts.map((transcript, index) => (
                <div
                  key={transcript.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{transcript.filename}</h3>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            #{index + 1}
                          </span>
                        </div>
                        
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-4 flex-wrap">
                            <span>📅 {formatDate(transcript.created_at)}</span>
                            <span>📦 {formatFileSize(transcript.file_size)}</span>
                            <span>✅ {transcript.tasks_created_count} task(s) created</span>
                          </div>
                          
                          {transcript.users?.name && (
                            <div className="text-xs">
                              Uploaded by: <span className="font-medium">{transcript.users.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewFile(transcript.file_url)}
                        title="View file"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(transcript.file_url, transcript.filename)}
                        title="Download file"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
