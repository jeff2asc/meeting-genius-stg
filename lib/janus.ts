/**
 * Janus Integration Helpers
 * 
 * Utilities for triggering real-time resyncs to the Janus system
 * whenever users, buildings, or companies are created/updated.
 */

// Auto-detect environment
const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';

const JANUS_API_BASE = (isLocal
  ? "http://localhost:3001"
  : (process.env.NEXT_PUBLIC_JANUS_URL || "")).replace(/\/$/, "");

const JANUS_API_KEY  = process.env.INTERNAL_API_KEY || ""
const JANUS_SYNC_ENDPOINT = "/api/janus/v1/sync"

/** Janus web app origin (no /api paths). */
export function getJanusAppBaseUrl(): string {
  const raw =
    typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:3001"
      : process.env.NEXT_PUBLIC_JANUS_URL || ""

  return (raw || "")
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
 *
 * @deprecated Prefer openJanusTicketSSO() which uses the proper SSO flow.
 * This function is kept for fallback/display purposes only (e.g. disabled button href).
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

  // Legacy bridge token path — only used as a fallback display URL
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

/**
 * Open a Janus ticket in a new tab using the proper SSO flow.
 *
 * Calls the MG server-side bridge (/api/janus/v1/bridge) which requests a
 * signed token from Janus server-to-server, then redirects the browser to
 * the ticket deep-link with that token. The user lands directly on the
 * ticket — no login form.
 *
 * @param ticket  The ticket object (needs a resolvable ticket ref)
 * @param email   The current user's email (from getCurrentUser())
 * @returns       true if the window was opened, false on error
 */
export async function openJanusTicketSSO(
  ticket: JanusTicketLike,
  email: string,
): Promise<boolean> {
  if (typeof window === "undefined" || !email) return false

  const ref = getJanusTicketRef(ticket)
  if (!ref) return false

  const ticketPath = buildJanusTicketPath(ref, ticket)

  try {
    const janusBase = (process.env.NEXT_PUBLIC_JANUS_URL || "").replace(/\/$/, "");
    const apiKey = process.env.INTERNAL_API_KEY || "";

    const res = await fetch("/api/bridge-sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase().trim(), redirect_to: ticketPath }),
    })

    const data = await res.json()

    if (!res.ok || !data.redirect_url) {
      console.error("[openJanusTicketSSO] Bridge error:", data)
      return false
    }

    window.open(data.redirect_url, "_blank", "noopener,noreferrer")
    return true
  } catch (err) {
    console.error("[openJanusTicketSSO] Fetch failed:", err)
    return false
  }
}

/** @deprecated Use openJanusTicketSSO() instead. */
export function openJanusTicketView(
  ticket: JanusTicketLike,
  options?: { email?: string; bridgeToken?: string },
): boolean {
  const url = buildJanusTicketViewUrl(ticket, options)
  if (!url || typeof window === "undefined") return false
  window.open(url, "_blank", "noopener,noreferrer")
  return true
}

