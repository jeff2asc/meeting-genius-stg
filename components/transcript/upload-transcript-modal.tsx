"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getCurrentUser } from "@/lib/supabase"

interface UploadTranscriptModalProps {
  isOpen: boolean
  onClose: () => void
  meetingId: number
  onUploadSuccess: (transcriptId: number, extractedTasks: any[]) => void
}

export function UploadTranscriptModal({
  isOpen,
  onClose,
  meetingId,
  onUploadSuccess,
}: UploadTranscriptModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    const allowedTypes = [
      "text/plain",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error("Invalid file type. Only .txt, .pdf, and .docx files are allowed.")
      return
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (selectedFile.size > maxSize) {
      toast.error("File size exceeds 10MB limit.")
      return
    }

    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file to upload.")
      return
    }

    const currentUser = getCurrentUser()
    if (!currentUser) {
      toast.error("You must be logged in to upload transcripts.")
      return
    }

    setIsUploading(true)

    try {
      // Create FormData
      const formData = new FormData()
      formData.append("file", file)
      formData.append("meeting_id", meetingId.toString())
      formData.append("user_id", currentUser.id.toString())

      // Upload to API
      const response = await fetch("/api/transcripts/upload", {
        method: "POST",
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_API_KEY || "meeting-genius-secret-key-2026",
        },
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || result.error || "Failed to upload transcript")
      }

      // Success
      toast.success(result.message || "Transcript uploaded successfully!")

      // Pass extracted tasks to parent component
      onUploadSuccess(result.transcript_id, result.extracted_tasks)

      // Reset and close
      setFile(null)
      onClose()
    } catch (error: any) {
      console.error("Upload error:", error)
      toast.error(error.message || "Failed to upload transcript")
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      setFile(null)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Meeting Transcript
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="transcript-file">Select Transcript File</Label>
            <div className="flex items-center gap-3">
              <Input
                id="transcript-file"
                type="file"
                accept=".txt,.pdf,.docx"
                onChange={handleFileChange}
                disabled={isUploading}
                className="flex-1"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Supported formats: .txt, .pdf, .docx (max 10MB)
            </p>
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Processing transcript and extracting tasks...
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload & Extract Tasks
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
