/**
 * Build the voter list for in-meeting decisions from meeting.attendees,
 * enriched with user_type / voting_weight when linked to a users row.
 */

export interface MeetingAttendeeRecord {
  name: string
  email?: string
  role?: string
  user_id?: number
  present?: boolean
}

export interface DbUserRecord {
  id: number
  name: string
  email?: string | null
  user_type?: string | null
  roles?: string[] | null
  voting_weight?: number | null
}

export interface MeetingVoter {
  /** users.id when linked; otherwise a stable synthetic id */
  id: number | string
  name: string
  email?: string
  user_type?: string
  roles?: string[] | null
  voting_weight?: number | null
  role?: string
  present?: boolean
}

function attendeeKey(att: MeetingAttendeeRecord): string {
  return (att.email?.toLowerCase() || att.name.trim().toLowerCase())
}

function inferUserTypeFromRole(role?: string): string | undefined {
  if (!role) return undefined
  const r = role.toLowerCase()
  if (r.includes("owner")) return "owner"
  if (r.includes("property manager") || r === "pm") return "property_manager"
  if (r.includes("corp") && r.includes("admin")) return "corporate_administrator"
  if (r.includes("resident")) return "resident"
  if (r.includes("attendee")) return "attendee"
  return undefined
}

export function buildMeetingVoters(
  attendees: MeetingAttendeeRecord[] | null | undefined,
  dbUsers: DbUserRecord[]
): MeetingVoter[] {
  const list = Array.isArray(attendees) ? attendees : []
  // Voters must match the meeting attendee list only — never fall back to all company users.
  if (list.length === 0) {
    return []
  }

  const userById = new Map(dbUsers.map((u) => [u.id, u]))
  const userByEmail = new Map(
    dbUsers
      .filter((u) => u.email)
      .map((u) => [u.email!.toLowerCase(), u])
  )

  const voters: MeetingVoter[] = []

  list.forEach((att, index) => {
    const name = att.name?.trim()
    if (!name) return

    const linked =
      (att.user_id != null ? userById.get(att.user_id) : undefined) ??
      (att.email ? userByEmail.get(att.email.toLowerCase()) : undefined)

    voters.push({
      id: linked?.id ?? `att-${index}-${attendeeKey(att)}`,
      name,
      email: att.email ?? linked?.email ?? undefined,
      user_type: linked?.user_type ?? inferUserTypeFromRole(att.role) ?? "attendee",
      roles: linked?.roles ?? null,
      voting_weight: linked?.voting_weight ?? 1,
      role: att.role,
      present: att.present,
    })
  })

  return voters.sort((a, b) => a.name.localeCompare(b.name))
}

/** Present attendees for vote eligibility; falls back to all if none marked present. */
export function getEligibleVoters(voters: MeetingVoter[]): MeetingVoter[] {
  const present = voters.filter((v) => v.present === true)
  return present.length > 0 ? present : voters
}

export function getVoterWeight(voters: MeetingVoter[], name: string): number {
  return voters.find((v) => v.name === name)?.voting_weight ?? 1
}

export function getEligibleHeadcount(voters: MeetingVoter[]): number {
  return getEligibleVoters(voters).length
}

export function getEligibleWeight(voters: MeetingVoter[]): number {
  return getEligibleVoters(voters).reduce((s, v) => s + (v.voting_weight ?? 1), 0)
}
