/**
 * Timezone utilities
 *
 * - **Floating** date/time: meeting schedule fields (stored & shown exactly as entered).
 * - **Instant** timestamps: created_at, updated_at, etc. (UTC in DB → viewer's local timezone).
 */

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/** IANA timezone for the current browser (e.g. America/Vancouver, Asia/Manila). */
export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/** Short label for UI (e.g. PST, GMT+8). */
export function getUserTimeZoneShort(timeZone?: string): string {
  const tz = timeZone ?? getUserTimeZone()
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date())
    const name = parts.find((p) => p.type === "timeZoneName")?.value
    return name || tz
  } catch {
    return tz
  }
}

function parseDateParts(dateString: string): { y: number; m: number; d: number } | null {
  const match = dateString.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const y = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const d = parseInt(match[3], 10)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m, d }
}

function parseTimeParts(timeString: string): { h: number; min: number } | null {
  const clean = timeString.trim().split(".")[0]
  const parts = clean.split(":").map((p) => parseInt(p, 10))
  if (parts.length < 2 || parts.some((n) => isNaN(n))) return null
  return { h: parts[0], min: parts[1] }
}

/** True for UTC instants from Supabase (ISO / timestamptz), not meeting floating fields. */
export function isIsoInstant(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  if (/^\d{1,2}:\d{2}/.test(v) && !v.includes("T") && !/\d{4}-\d{2}-\d{2}/.test(v)) {
    return false
  }
  return (
    v.includes("T") ||
    (/\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(v)) ||
    /[zZ]$/.test(v) ||
    /[+-]\d{2}:?\d{2}$/.test(v)
  )
}

/** Parse DB timestamptz / ISO string as UTC instant. */
export function parseInstant(value: string): Date | null {
  if (!value?.trim()) return null
  if (!isIsoInstant(value)) return null

  let s = value.trim()
  if (!s.includes("T")) {
    s = s.replace(" ", "T")
  }
  if (!/[zZ]|[+-]\d{2}/.test(s)) {
    s += "Z"
  }

  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

type FormatInstantOptions = {
  timeZone?: string
  style?: "long" | "short"
  withTime?: boolean
}

/** Format a UTC instant in the user's (or given) timezone. */
export function formatInstantToLocal(
  iso: string,
  options: FormatInstantOptions = {},
): string {
  const d = parseInstant(iso)
  if (!d) return iso || ""

  const tz = options.timeZone ?? getUserTimeZone()
  const withTime = options.withTime !== false

  if (options.style === "short" && !withTime) {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d)
  }

  if (options.style === "short") {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d)
  }

  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime
      ? { hour: "numeric", minute: "2-digit" as const }
      : {}),
  }).format(d)
}

/** Display YYYY-MM-DD without timezone conversion (meeting dates). */
export function formatFloatingDate(
  dateString: string,
  style: "long" | "short" = "long",
): string {
  if (!dateString) return "No date"
  const p = parseDateParts(dateString)
  if (!p) return dateString

  if (style === "short") {
    return `${MONTHS_SHORT[p.m - 1]} ${p.d}, ${p.y}`
  }

  const weekday = WEEKDAYS[new Date(p.y, p.m - 1, p.d).getDay()]
  return `${weekday}, ${MONTHS_LONG[p.m - 1]} ${p.d}, ${p.y}`
}

/** Display HH:MM(:SS) as 12-hour clock without timezone conversion (meeting times). */
export function formatFloatingTime(timeString: string): string | null {
  if (!timeString) return null
  const p = parseTimeParts(timeString)
  if (!p) return timeString

  const ampm = p.h >= 12 ? "PM" : "AM"
  const hour12 = p.h % 12 === 0 ? 12 : p.h % 12
  return `${hour12}:${String(p.min).padStart(2, "0")} ${ampm}`
}

/**
 * Format a floating meeting time (HH:MM) with an optional building timezone label.
 * The time value itself is NOT converted — it is always shown as stored.
 * The timezone label (e.g. "PST", "EST") is appended so viewers in other
 * locations know which timezone the meeting is scheduled in.
 *
 * @param timeString  HH:MM or HH:MM:SS
 * @param timezone    IANA timezone string from the building, e.g. "America/Vancouver"
 */
export function formatFloatingTimeWithZone(
  timeString: string,
  timezone?: string | null,
): string | null {
  const base = formatFloatingTime(timeString)
  if (!base) return null
  if (!timezone) return base

  try {
    // Get the short label for the building's timezone (e.g. PST, EST, AEST)
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date())
    const tzLabel = parts.find((p) => p.type === "timeZoneName")?.value
    return tzLabel ? `${base} ${tzLabel}` : base
  } catch {
    return base
  }
}

/**
 * Format a floating meeting date + time with building timezone label.
 * Used in meeting view header, dashboard cards, and email notices.
 */
export function formatMeetingDateTime(
  dateString: string,
  timeString: string | null | undefined,
  timezone?: string | null,
  dateStyle: "long" | "short" = "long",
): string {
  const datePart = formatFloatingDate(dateString, dateStyle)
  if (!timeString) return datePart
  const timePart = formatFloatingTimeWithZone(timeString, timezone)
  return timePart ? `${datePart} at ${timePart}` : datePart
}

/**
 * Long date (+ optional time).
 * - ISO instants → user's local timezone.
 * - YYYY-MM-DD (+ optional HH:MM) → floating (meetings).
 */
export function formatUtcToLocalLong(dateString: string, timeString?: string): string {
  if (!dateString) return "No date"

  if (!timeString && isIsoInstant(dateString)) {
    return formatInstantToLocal(dateString, { style: "long" })
  }

  const datePart = formatFloatingDate(dateString, "long")
  if (!timeString) return datePart
  const timePart = formatFloatingTime(timeString)
  return timePart ? `${datePart} at ${timePart}` : datePart
}

/**
 * Time display: floating HH:MM for meetings; instant time part if an ISO string is passed.
 */
export function formatUtcToLocalShort(
  timeString: string,
  _contextDate?: string,
): string | null {
  if (!timeString) return null
  if (isIsoInstant(timeString)) {
    const d = parseInstant(timeString)
    if (!d) return timeString
    return new Intl.DateTimeFormat(undefined, {
      timeZone: getUserTimeZone(),
      hour: "numeric",
      minute: "2-digit",
    }).format(d)
  }
  return formatFloatingTime(timeString)
}

/**
 * Meeting form load/save — floating values only (no UTC shift).
 */
export function utcToLocalDateTime(
  utcDate: string,
  utcTime: string,
): { date: string; time: string } {
  if (!utcDate || !utcTime) {
    return { date: utcDate || "", time: utcTime || "" }
  }
  const time = utcTime.length > 5 ? utcTime.substring(0, 5) : utcTime
  return { date: utcDate, time }
}

export function localDateTimeToUtcIso(
  localDate: string,
  localTime: string,
): { date: string; time: string } {
  if (!localDate || !localTime) {
    return { date: localDate || "", time: localTime || "" }
  }
  const time = localTime.length === 5 ? `${localTime}:00` : localTime
  return { date: localDate, time }
}

/** Notes, tasks, decisions, tickets — UTC instant → user's local timezone. */
export function formatUtcToLocalDateTime(
  utcIsoString: string,
  timeZone?: string,
): string {
  if (!utcIsoString) return ""

  if (isIsoInstant(utcIsoString)) {
    return formatInstantToLocal(utcIsoString, {
      timeZone,
      style: "short",
      withTime: true,
    })
  }

  let cleanIso = utcIsoString.trim()
  cleanIso = cleanIso.replace(/Z$/, "").replace(/[+-]\d{2}:?\d{2}$/, "").replace(" ", "T")
  const parts = cleanIso.split("T")
  const datePart = formatFloatingDate(parts[0], "short")
  const timePart = parts[1] ? formatFloatingTime(parts[1]) : null
  if (!timePart) return datePart
  return `${datePart} at ${timePart}`
}

export function getCurrentLocalDate(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getCurrentLocalTime(): string {
  const date = new Date()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}
