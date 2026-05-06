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
  initialData?: {
    description?: string
    status?: string
  }
}

export default function UnifiedItemModal({
  isOpen,
  onClose,
  topicId,
  meetingId,
  onSave,
  defaultTab = 'task',
  initialData
}: UnifiedItemModalProps) {
  const [activeTab, setActiveTab] = useState<'task' | 'note' | 'decision'>(defaultTab)

  if (!isOpen) return null

  const handleItemSaved = () => {
    // Nothing - just acknowledge the save happened
  }

  const handleClose = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
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
        <div className="flex border-b shrink-0 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('task')}
            className={`flex-1 min-w-[80px] px-2 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'task'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Tasks
          </button>
          <button
            onClick={() => setActiveTab('note')}
            className={`flex-1 min-w-[80px] px-2 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'note'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Notes
          </button>
          <button
            onClick={() => setActiveTab('decision')}
            className={`flex-1 min-w-[80px] px-2 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'decision'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Decisions
          </button>
        </div>

        {/* ✅ FIX: overflow-y-auto so content scrolls instead of being clipped */}
        <div className="flex-1 overflow-y-auto">
          <div className={activeTab === 'task' ? 'block' : 'hidden'}>
            <TaskModal
              isOpen={true}
              onClose={handleItemSaved}
              onSave={onSave}
              topicId={topicId}
              meetingId={meetingId}
              embedded={true}
              initialData={initialData}
            />
          </div>

          <div className={activeTab === 'note' ? 'block' : 'hidden'}>
            <NoteModal
              isOpen={true}
              onClose={handleItemSaved}
              onSave={onSave}
              topicId={topicId}
              meetingId={meetingId}
              embedded={true}
            />
          </div>

          <div className={activeTab === 'decision' ? 'block' : 'hidden'}>
            <DecisionModal
              isOpen={true}
              onClose={handleItemSaved}
              onSave={onSave}
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
