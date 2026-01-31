"use client"

import { useState, useRef } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import TaskModal from "./task-modal"
import NoteModal from "./note-modal"
import DecisionModal from "./decision-modal"

interface UnifiedItemModalProps {
  isOpen: boolean
  onClose: () => void
  topicId: number
  meetingId: string
  onSave: () => void
  defaultTab?: 'task' | 'note' | 'decision'
}

export default function UnifiedItemModal({
  isOpen,
  onClose,
  topicId,
  meetingId,
  onSave,
  defaultTab = 'task'
}: UnifiedItemModalProps) {
  const [activeTab, setActiveTab] = useState<'task' | 'note' | 'decision'>(defaultTab)

  if (!isOpen) return null

  // Called when items are saved - we don't do anything here
  // Parent will refresh when modal closes
  const handleItemSaved = () => {
    // Nothing - just acknowledge the save happened
  }

  // Called when X is clicked - notify parent to refresh
  const handleClose = () => {
    onClose() // This triggers fetchSectionsAndTopics() in meeting-view.tsx
  }
  

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Topic Items</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('task')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'task'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tasks
          </button>
          <button
            onClick={() => setActiveTab('note')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'note'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Notes
          </button>
          <button
            onClick={() => setActiveTab('decision')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'decision'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Decisions
          </button>
        </div>

        {/* Content - ALL tabs are mounted, just hidden with CSS */}
        <div className="flex-1 overflow-hidden">
          {/* Task Tab - Always mounted, just hidden */}
          <div className={activeTab === 'task' ? 'block h-full' : 'hidden'}>
            <TaskModal
              isOpen={true}
              onClose={handleItemSaved}
              topicId={topicId}
              meetingId={meetingId}
              embedded={true}
            />
          </div>

          {/* Note Tab - Always mounted, just hidden */}
          <div className={activeTab === 'note' ? 'block h-full' : 'hidden'}>
            <NoteModal
              isOpen={true}
              onClose={handleItemSaved}
              topicId={topicId}
              meetingId={meetingId}
              embedded={true}
            />
          </div>

          {/* Decision Tab - Always mounted, just hidden */}
          <div className={activeTab === 'decision' ? 'block h-full' : 'hidden'}>
            <DecisionModal
              isOpen={true}
              onClose={handleItemSaved}
              topicId={topicId}
              meetingId={meetingId}
              embedded={true}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
