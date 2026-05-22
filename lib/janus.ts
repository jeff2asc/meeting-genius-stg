/**
 * Janus Integration Helpers
 * 
 * Utilities for triggering real-time resyncs to the Janus system
 * whenever users, buildings, or companies are created/updated.
 */

// Auto-detect environment
const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';

const JANUS_API_BASE = isLocal
  ? "http://localhost:3001"
  : (process.env.NEXT_PUBLIC_JANUS_URL || "https://janusapp.meetinggenius.ca");

const JANUS_API_KEY  = process.env.NEXT_PUBLIC_API_KEY || ""
const JANUS_SYNC_ENDPOINT = "/api/janus/v1/sync"

/** Janus web app origin (no /api paths). */
export function getJanusAppBaseUrl(): string {
  const raw =
    typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:3001"
      : process.env.NEXT_PUBLIC_JANUS_URL || "https://janusapp.meetinggenius.ca"

  return raw
    .replace(/\/api\/janus\/v1\/sync\/?$/i, "")
    .replace(/\/api\/?$/i, "")
    .replace(/\/$/, "")
}

export type JanusTicketLike = {
  janus_ticket_id?: string | number | null
  ticket_id?: string | number | null
  ticket_number?: string | number | null
  external_id?: string | number | null
  id?: string | number | null
  type?: string | null
  _type?: string | null
}

/** Resolve the Janus ticket identifier (never prefer MG cache row id alone). */
export function getJanusTicketRef(ticket: JanusTicketLike): string {
  const candidates = [
    ticket.janus_ticket_id,
    ticket.ticket_id,
    ticket.ticket_number,
    ticket.external_id,
  ]

  for (const c of candidates) {
    if (c != null && String(c).trim()) {
      return String(c).trim()
    }
  }

  if (ticket.id != null && String(ticket.id).trim()) {
    return `ticket-${String(ticket.id).trim()}`
  }

  return ""
}

/** Normalize for Janus dashboard URLs (repairs, complaints, all ticket_id formats). */
export function normalizeJanusTicketRefForUrl(ref: string): string {
  let trimmed = ref.trim()
  if (!trimmed) return ""

  trimmed = trimmed.replace(/^#(?:REP|COM)-/i, "")

  if (/^ticket-/i.test(trimmed)) {
    return trimmed
  }

  if (/^\d+$/.test(trimmed)) {
    return `ticket-${trimmed}`
  }

  return trimmed
}

/** Label for cards/modal — shows Janus ticket id when available. */
export function formatJanusTicketDisplayLabel(
  ticket: JanusTicketLike,
  kind?: "repair" | "complaint",
): string {
  const ref = getJanusTicketRef(ticket)
  if (!ref) return "—"

  const urlRef = normalizeJanusTicketRefForUrl(ref)
  if (/^ticket-/i.test(urlRef)) {
    return urlRef
  }

  const isComplaint =
    kind === "complaint" ||
    ticket._type === "complaint" ||
    ticket.type === "complaint"
  const prefix = isComplaint ? "#COM-" : "#REP-"
  return `${prefix}${ref}`
}

function buildJanusTicketPath(ref: string, ticket?: JanusTicketLike): string {
  const normalized = normalizeJanusTicketRefForUrl(ref)
  const template =
    process.env.NEXT_PUBLIC_JANUS_TICKET_PATH || "/dashboard/tickets/{ref}"
  const ticketType = ticket?.type || ticket?._type || "repair"

  const path = template
    .replace("{ref}", encodeURIComponent(normalized))
    .replace("{type}", encodeURIComponent(ticketType))

  return path.startsWith("/") ? path : `/${path}`
}

/**
 * Deep link to a ticket in the Janus dashboard (all repairs & complaints).
 * Uses /dashboard/tickets/{ticket_id} — not root /tickets/... (404).
 */
export function buildJanusTicketViewUrl(
  ticket: JanusTicketLike,
  options?: {
    email?: string
    bridgeToken?: string
  },
): string | null {
  const ref = getJanusTicketRef(ticket)
  if (!ref) return null

  const base = getJanusAppBaseUrl()
  const ticketPath = buildJanusTicketPath(ref, ticket)

  if (options?.email && options?.bridgeToken) {
    const params = new URLSearchParams({
      email: options.email,
      bridge_token: options.bridgeToken,
      redirect: ticketPath,
    })
    return `${base}/login?${params.toString()}`
  }

  return `${base}${ticketPath}`
}

/** Open any Janus ticket (repair or complaint) in a new tab. */
export function openJanusTicketView(
  ticket: JanusTicketLike,
  options?: { email?: string; bridgeToken?: string },
): boolean {
  const url = buildJanusTicketViewUrl(ticket, options)
  if (!url || typeof window === "undefined") return false
  window.open(url, "_blank", "noopener,noreferrer")
  return true
}

/**
 * Notify Janus to resync its data from Meeting Genius.
 * Can be used for a generic resync or a surgical push of a specific entity.
 * 
 * @param reason      Short description of what changed (e.g. "user_created", "building_added")
 * @param data        Optional: The actual entity data (user, building, etc.) to sync immediately
 * @param entityType  Optional: The type of entity being pushed ('user', 'building', 'company')
 * @param companyId   Optional: The company ID to check for integration status
 */
export async function triggerJanusResync(
  reason = "entity_change", 
  data: any = null, 
  entityType: 'user' | 'building' | 'company' | null = null,
  companyId?: number | null
): Promise<void> {
  try {
    // If companyId is provided, we can optionally check if integration is enabled
    // For now, we'll proceed but log the company context
    const cid = companyId || data?.company_id || (entityType === 'company' ? data?.id : null);
    
    if (cid) {
      console.log(`📡 [Janus] Attempting surgical push for Company ${cid}: ${reason}`);
    }

    // Push a resync signal to Janus
    const response = await fetch(`${JANUS_API_BASE}${JANUS_SYNC_ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": JANUS_API_KEY,
      },
      body: JSON.stringify({
        source: "meeting-genius",
        reason,
        entity_type: entityType,
        data: data,
        timestamp: new Date().toISOString(),
      }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`✅ [Janus] Resync triggered — reason: ${reason}`, result.mode || "bulk")
      return result
    }
  } catch (err) {
    // Never crash the main flow — just log
    console.warn("⚠️ [Janus] Resync notification failed (non-critical):", err)
  }
}
