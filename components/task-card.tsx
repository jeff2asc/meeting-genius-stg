"use client"

import { Calendar, User } from "lucide-react"
import { Card } from "@/components/ui/card"

interface TaskCardProps {
  task: {
    id: string
    description: string
    assignee: string
    dueDate: string
    urgency: "high" | "medium" | "low"
  }
}

export default function TaskCard({ task }: TaskCardProps) {
  const urgencyColors = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-green-100 text-green-800 border-green-200",
  }

  return (
    <Card className="border-0 bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-2">{task.description}</h3>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{task.assignee}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Due: {task.dueDate}</span>
              </div>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium border ${urgencyColors[task.urgency]}`}>
            {task.urgency.charAt(0).toUpperCase() + task.urgency.slice(1)}
          </div>
        </div>
      </div>
    </Card>
  )
}