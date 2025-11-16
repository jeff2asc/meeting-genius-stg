"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

interface TimerProps {
  elapsedTime: number
}

export default function Timer({ elapsedTime }: TimerProps) {
  const [time, setTime] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const hours = Math.floor(time / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  const seconds = time % 60

  const formatTime = (num: number) => String(num).padStart(2, "0")

  return (
    <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
      <Clock className="h-4 w-4 text-primary" />
      <span className="font-mono font-semibold text-foreground">
        {formatTime(hours)}:{formatTime(minutes)}:{formatTime(seconds)}
      </span>
    </div>
  )
}
