/**
 * Janus Integration Helpers
 * 
 * Utilities for triggering real-time resyncs to the Janus system
 * whenever users, buildings, or companies are created/updated.
 */

const JANUS_API_BASE = process.env.NEXT_PUBLIC_JANUS_API_URL || "http://localhost:3001"
const JANUS_API_KEY  = process.env.NEXT_PUBLIC_JANUS_API_KEY  || "meeting-genius-secret-key-2026"
const MG_SYNC_ENDPOINT = "/api/janus/v1/sync"

/**
 * Notify Janus to resync its data from Meeting Genius.
 * This is fire-and-forget — it will NOT block the caller.
 * 
 * @param reason  Short description of what changed (e.g. "user_created", "building_added")
 */
export async function triggerJanusResync(reason = "entity_change"): Promise<void> {
  try {
    // 1. Tell our own sync endpoint to mark data as fresh (handshake)
    await fetch(MG_SYNC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": JANUS_API_KEY,
      },
      body: JSON.stringify({ action: "resync_notify", reason }),
    })

    // 2. Push a resync signal to Janus if the URL is configured
    if (JANUS_API_BASE) {
      await fetch(`${JANUS_API_BASE}/api/mg/resync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": JANUS_API_KEY,
        },
        body: JSON.stringify({
          source: "meeting-genius",
          reason,
          sync_url: `${window.location.origin}${MG_SYNC_ENDPOINT}`,
          timestamp: new Date().toISOString(),
        }),
      })
    }

    console.log(`✅ [Janus] Resync triggered — reason: ${reason}`)
  } catch (err) {
    // Never crash the main flow — just log
    console.warn("⚠️ [Janus] Resync notification failed (non-critical):", err)
  }
}
