"use client"

import { X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DocumentManagementModalProps {
  isOpen: boolean
  onClose: () => void
  documentFormUrl: string
}

export default function DocumentManagementModal({
  isOpen,
  onClose,
  documentFormUrl
}: DocumentManagementModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
      <div className="bg-card rounded-lg shadow-xl w-full h-full m-4 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-xl font-semibold text-foreground flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Building Document Management</span>
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <iframe
            src={documentFormUrl}
            className="w-full h-full border-0"
            title="Building Document Form"
          />
        </div>
        
        <div className="p-4 border-t border-border bg-muted">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Documents will be processed and available for AI analysis
            </p>
            <Button
              onClick={onClose}
              variant="outline"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}