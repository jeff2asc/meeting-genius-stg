"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface Building {
  id: number
  name: string
  address: string | null
}

interface ViewDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  viewingDocument: { building: Building; content: string } | null
}

export default function ViewDocumentModal({
  isOpen,
  onClose,
  viewingDocument
}: ViewDocumentModalProps) {
  if (!isOpen || !viewingDocument) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] border-0 rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Rules and Regulations</h2>
            <p className="text-sm text-muted-foreground">
              {viewingDocument.building.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground bg-muted p-4 rounded">
              {viewingDocument.content}
            </pre>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-muted">
          <div className="flex justify-end">
            <Button
              onClick={onClose}
              variant="outline"
            >
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}