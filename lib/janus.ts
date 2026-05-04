/**
 * Janus Integration Helpers
 * 
 * Utilities for triggering real-time resyncs to the Janus system
 * whenever users, buildings, or companies are created/updated.
 */

const JANUS_API_BASE = process.env.NEXT_PUBLIC_JANUS_API_URL || "https://janusapp.meetinggenius.ca"
const JANUS_API_KEY  = process.env.NEXT_PUBLIC_JANUS_API_KEY  || "meeting-genius-secret-key-2026"
const JANUS_SYNC_ENDPOINT = "/api/janus/v1/sync"

/**
 * Notify Janus to resync its data from Meeting Genius.
 * This is fire-and-forget — it will NOT block the caller.
 * 
 * @param reason  Short description of what changed (e.g. "user_created", "building_added")
 */
export async function triggerJanusResync(reason = "entity_change"): Promise<void> {
  try {
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
        timestamp: new Date().toISOString(),
      }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`✅ [Janus] Resync triggered — reason: ${reason}`, result.summary)
      return result.janus_data
    }
  } catch (err) {
    // Never crash the main flow — just log
    console.warn("⚠️ [Janus] Resync notification failed (non-critical):", err)
  }
}
