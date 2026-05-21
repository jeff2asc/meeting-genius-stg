/**
 * Timezone utilities — floating date/time (stored and shown exactly as entered).
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

/** Display YYYY-MM-DD without timezone conversion. */
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

/** Display HH:MM(:SS) as 12-hour clock without timezone conversion. */
export function formatFloatingTime(timeString: string): string | null {
  if (!timeString) return null
  const p = parseTimeParts(timeString)
  if (!p) return timeString

  const ampm = p.h >= 12 ? "PM" : "AM"
  const hour12 = p.h % 12 === 0 ? 12 : p.h % 12
  return `${hour12}:${String(p.min).padStart(2, "0")} ${ampm}`
}

/**
 * Long date (+ optional time) — floating, no UTC shift.
 */
export function formatUtcToLocalLong(dateString: string, timeString?: string): string {
  if (!dateString) return "No date"
  const datePart = formatFloatingDate(dateString, "long")
  if (!timeString) return datePart
  const timePart = formatFloatingTime(timeString)
  return timePart ? `${datePart} at ${timePart}` : datePart
}

export function formatUtcToLocalShort(timeString: string, _contextDate?: string): string | null {
  return formatFloatingTime(timeString)
}

/**
 * Convert UTC date and time to local browser timezone
 * Used when loading data from database to display in forms
 * @param utcDate - Date in YYYY-MM-DD format (UTC)
 * @param utcTime - Time in HH:MM:SS format (UTC)
 * @returns Object with local date and time
 */
export function utcToLocalDateTime(
  utcDate: string,
  utcTime: string
): { date: string; time: string } {
  if (!utcDate || !utcTime) {
    return { date: utcDate || "", time: utcTime || "" }
  }

  // Bypass UTC conversion. Return the date and time exactly as stored in database.
  const time = utcTime.length > 5 ? utcTime.substring(0, 5) : utcTime
  return { date: utcDate, time }
}

/**
 * Convert local browser date and time to UTC
 * Used when saving form data back to database
 * @param localDate - Date in YYYY-MM-DD format (local)
 * @param localTime - Time in HH:MM format (local)
 * @returns Object with UTC date and time
 */
export function localDateTimeToUtcIso(
  localDate: string,
  localTime: string
): { date: string; time: string } {
  if (!localDate || !localTime) {
    return { date: localDate || "", time: localTime || "" }
  }

  // Bypass UTC conversion. Stored exactly as entered.
  const time = localTime.length === 5 ? `${localTime}:00` : localTime
  return { date: localDate, time }
}

/**
 * Format a full UTC ISO string to local locale string
 * Ensures 'Z' is appended if missing to force UTC interpretation
 */
export function formatUtcToLocalDateTime(utcIsoString: string): string {
  if (!utcIsoString) return ""

  let cleanIso = utcIsoString.trim()
  cleanIso = cleanIso.replace(/Z$/, "").replace(/[+-]\d{2}:?\d{2}$/, "").replace(" ", "T")

  const parts = cleanIso.split("T")
  const datePart = formatFloatingDate(parts[0], "short")
  const timePart = parts[1] ? formatFloatingTime(parts[1]) : null
  if (!timePart) return datePart
  return `${datePart} at ${timePart}`
}
/**
 * Get current local date in YYYY-MM-DD format
 */
export function getCurrentLocalDate(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get current local time in HH:MM format
 */
export function getCurrentLocalTime(): string {
  const date = new Date()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}
