"use client"

import { useEffect, useState } from "react"
import { Clock as ClockIcon } from "lucide-react"
import { getUserTimeZone, getUserTimeZoneShort } from "@/lib/timezone"

type UserClockProps = {
  className?: string
  iconClassName?: string
  compact?: boolean
}

/** Live clock in the signed-in user's browser timezone (auto per device/location). */
export default function UserClock({
  className = "",
  iconClassName = "h-3.5 w-3.5 text-primary animate-pulse",
  compact = false,
}: UserClockProps) {
  const [now, setNow] = useState(() => new Date())
  const [tzShort, setTzShort] = useState("")

  useEffect(() => {
    setTzShort(getUserTimeZoneShort())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateFmt: Intl.DateTimeFormatOptions = compact
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" }

  return (
    <div
      className={
        className ||
        "flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50"
      }
      title={`Your local time — ${getUserTimeZone()}`}
    >
      <ClockIcon className={iconClassName} />
      <span className="whitespace-nowrap font-bold">
        {now.toLocaleDateString(undefined, dateFmt)}
      </span>
      <span className="opacity-20 font-light">|</span>
      <span className="whitespace-nowrap">
        {now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: compact ? undefined : "2-digit",
        })}
      </span>
      {tzShort && (
        <>
          <span className="opacity-20 font-light">|</span>
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide opacity-80">
            {tzShort}
          </span>
        </>
      )}
    </div>
  )
}
