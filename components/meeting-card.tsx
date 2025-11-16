"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface MeetingCardProps {
  meeting: {
    id: string
    building: string
    title: string
    date: string
    status: "Draft" | "In Progress" | "Finalized"
  }
  onStart: () => void
}

export default function MeetingCard({ meeting, onStart }: MeetingCardProps) {
  const statusColors = {
    Draft: "bg-status-draft/10 text-status-draft border-status-draft/20",
    "In Progress": "bg-status-progress/10 text-status-progress border-status-progress/20",
    Finalized: "bg-status-finalized/10 text-status-finalized border-status-finalized/20",
  }

  return (
    <Card className="border-0 bg-card shadow-md transition-all hover:shadow-lg">
      <div className="p-6">
        <div className="mb-3 flex items-start justify-between">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {meeting.building}
          </Badge>
          <Badge className={`border ${statusColors[meeting.status]}`}>{meeting.status}</Badge>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">{meeting.title}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{meeting.date}</p>
        <Button
          onClick={onStart}
          className="w-full bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90"
        >
          Start Meeting
        </Button>
      </div>
    </Card>
  )
}
