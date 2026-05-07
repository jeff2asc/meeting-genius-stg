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
  : (process.env.NEXT_PUBLIC_JANUS_API_URL || "https://janusapp.meetinggenius.ca");

const JANUS_API_KEY  = process.env.NEXT_PUBLIC_JANUS_API_KEY  || "meeting-genius-secret-key-2026"
const JANUS_SYNC_ENDPOINT = "/api/janus/v1/sync"

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
