/**
 * Timezone utility functions for Meeting Genius
 * Handles conversion between UTC (database) and local browser timezone (display)
 */

/**
 * Format UTC date and time to local long format
 * Used for displaying dates in full format (e.g., "Thursday, January 8, 2026")
 */
export function formatUtcToLocalLong(dateString: string, timeString?: string): string {
  if (!dateString) return "No date"

  // Combine with midnight UTC time if no time provided
  const combinedIso = timeString
    ? `${dateString}T${timeString}`
    : `${dateString}T00:00:00`

  const date = new Date(combinedIso)

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatUtcToLocalShort(timeString: string, contextDate?: string): string | null {
  if (!timeString) return null

  // ⭐ FIXED: Use the actual context date for correct DST offset handling
  const referenceDate = contextDate || getCurrentLocalDate()
  const combinedIso = `${referenceDate}T${timeString}`

  const date = new Date(combinedIso)
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
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

  // Create a Date object from UTC date and time
  const utcIsoString = `${utcDate}T${utcTime}Z`
  const date = new Date(utcIsoString)

  // Get local date in YYYY-MM-DD format
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const localDate = `${year}-${month}-${day}`

  // Get local time in HH:MM format (for time input)
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const localTime = `${hours}:${minutes}`

  return { date: localDate, time: localTime }
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

  // Create a Date object from local date and time
  const localIsoString = `${localDate}T${localTime}:00`
  const date = new Date(localIsoString)

  // Get UTC date in YYYY-MM-DD format
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  const utcDate = `${year}-${month}-${day}`

  // Get UTC time in HH:MM:SS format
  const hours = String(date.getUTCHours()).padStart(2, "0")
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  const seconds = String(date.getUTCSeconds()).padStart(2, "0")
  const utcTime = `${hours}:${minutes}:${seconds}`

  return { date: utcDate, time: utcTime }
}

/**
 * Format a full UTC ISO string to local locale string
 * Ensures 'Z' is appended if missing to force UTC interpretation
 */
export function formatUtcToLocalDateTime(utcIsoString: string): string {
  if (!utcIsoString) return ""

  // If it already has Z or offset, use as is. 
  // Otherwise, handle space-as-T and append Z.
  let cleanIso = utcIsoString.trim()
  if (!cleanIso.includes('Z') && !cleanIso.match(/[+-]\d{2}(:?\d{2})?$/)) {
    cleanIso = cleanIso.replace(' ', 'T') + 'Z'
  }

  const date = new Date(cleanIso)
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return utcIsoString // fallback to original string if parsing fails
  }

  return date.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
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
