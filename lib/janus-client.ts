"use server"

// ─── SSO Password Sync ─────────────────────────────────────────────────────
// Janus accounts mirror MG accounts. When a non-master user changes their
// password in MG, we push the identical bcrypt hash to Janus so both
// applications share one credential without a separate login.

import { createClient } from '@supabase/supabase-js';

/**
 * Janus Supabase Client (Private)
 * 
 * We use lazy initialization to ensure this only runs on the server
 * and doesn't crash client-side bundles.
 */
let _janusClient: any = null;

export async function getJanusClient() {
  if (_janusClient) return _janusClient;

  const janusUrl = process.env.JANUS_SUPABASE_URL;
  const janusKey = process.env.JANUS_SUPABASE_SERVICE_ROLE_KEY;

  if (!janusUrl || !janusKey) {
    throw new Error("Janus Supabase credentials missing. Ensure JANUS_SUPABASE_URL and JANUS_SUPABASE_SERVICE_ROLE_KEY are set.");
  }

  _janusClient = createClient(janusUrl, janusKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });

  return _janusClient;
}

/**
 * Helper to fetch Janus tickets directly
 */
export async function fetchJanusTicketsDirect(companyId?: number | null) {
  const client = await getJanusClient();
  let query = client.from('tickets').select('*');
  
  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    console.error("❌ Failed to fetch tickets from Janus:", error.message);
    throw error;
  }
  
  return data;
}

/**
 * Helper to fetch a user from Janus by email with their properties
 */
export async function fetchJanusUserByEmail(email: string) {
  if (!email) return null;

  try {
    const client = await getJanusClient();
    // 1. Fetch user
    const { data: user, error: userError } = await client
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (userError || !user) return null;

    // 2. Fetch their property associations
    const { data: properties, error: propError } = await client
      .from('user_properties')
      .select('building_id, unit_number, company_id')
      .eq('user_id', user.id);

    return {
      ...user,
      properties: properties || []
    };
  } catch (err) {
    console.error("❌ Failed to fetch user from Janus:", err);
    return null;
  }
}

/**
 * Notify Janus to resync its data from Meeting Genius (Server Action).
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
    const janusBase = (process.env.NEXT_PUBLIC_JANUS_URL || "https://janusapp.meetinggenius.ca").replace(/\/$/, "");
    const apiKey = process.env.INTERNAL_API_KEY || "";
    const endpoint = "/api/janus/v1/sync";

    const response = await fetch(`${janusBase}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        source: "meeting-genius",
        reason,
        entity_type: entityType,
        data: data,
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ [Janus] Server-side resync triggered — reason: ${reason}`);
      return result;
    }
  } catch (err) {
    console.warn("⚠️ [Janus] Server-side resync failed:", err);
  }
}

/**
 * Sync a new password hash to Janus's user record.
 *
 * This is the *strong* SSO sync: after MG updates its own users.password_hash,
 * we write the identical bcrypt hash directly into the Janus Supabase DB so the
 * user can log into Janus with the same new password immediately.
 *
 * ⚠️  Master accounts are explicitly excluded — their credentials are managed
 *     independently and must never be overwritten by this flow.
 *
 * @param email       The user's email (used to locate them in Janus)
 * @param newHash     The bcrypt hash that was just saved to MG's DB
 * @param userType    The MG user_type — must NOT be 'master'
 */
export async function syncPasswordToJanus(
  email: string,
  newHash: string,
  userType: string
): Promise<void> {
  // ─── Guard: never sync master accounts ───────────────────────────────────
  if (!email || !newHash) {
    console.warn("[Janus PWSync] Skipped — missing email or hash.");
    return;
  }
  if (userType?.toLowerCase() === "master") {
    console.log(`[Janus PWSync] Skipped master account: ${email}`);
    return;
  }

  try {
    const client = await getJanusClient();

    // 1. Find the matching user in Janus by email
    const { data: janusUser, error: findError } = await client
      .from("users")
      .select("id, email")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (findError) {
      console.error("[Janus PWSync] Error looking up user:", findError.message);
      return;
    }

    if (!janusUser) {
      console.warn(`[Janus PWSync] User not found in Janus: ${email} — skipping sync.`);
      return;
    }

    // 2. Write the new hash directly to Janus
    const { error: updateError } = await client
      .from("users")
      .update({ password: newHash })
      .eq("id", janusUser.id);

    if (updateError) {
      console.error(`[Janus PWSync] Failed to update password for ${email}:`, updateError.message);
      return;
    }

    console.log(`✅ [Janus PWSync] Password synced for ${email} (Janus user id=${janusUser.id})`);
  } catch (err) {
    // Non-blocking — a Janus sync failure must never break MG's own password update
    console.error("[Janus PWSync] Unexpected error:", err);
  }
}

// ─── Janus Account Lockout (Integration Toggle) ─────────────────────────────
// When a company uninstalls the Janus integration in MG, their users must be
// prevented from logging into Janus. We do this by setting mg_access = false
// directly in Janus's DB. On re-install we set mg_access = true again.
//
// The Janus login handler is expected to reject users where mg_access = false.
// (If Janus doesn't yet have this column, the update is a no-op and won't error.)

/**
 * Lock all Janus accounts belonging to a given MG company.
 * Called when the company uninstalls the Janus integration.
 *
 * @param companyId  The MG company ID whose users should be locked out
 * @returns          { locked: number } count of rows updated, or throws on error
 */
export async function lockJanusCompany(companyId: number): Promise<{ locked: number }> {
  if (!companyId) throw new Error("[Janus Lockout] companyId is required");

  const client = await getJanusClient();

  const { data, error } = await client
    .from("users")
    .update({ mg_access: false })
    .eq("company_id", companyId)
    .select("id");

  if (error) {
    console.error(`[Janus Lockout] Failed to lock company ${companyId}:`, error.message);
    throw error;
  }

  const locked = data?.length ?? 0;
  console.log(`🔒 [Janus Lockout] Locked ${locked} users for company ${companyId}`);
  return { locked };
}

/**
 * Unlock all Janus accounts belonging to a given MG company.
 * Called when the company installs (or re-installs) the Janus integration.
 *
 * @param companyId  The MG company ID whose users should regain access
 * @returns          { unlocked: number } count of rows updated, or throws on error
 */
export async function unlockJanusCompany(companyId: number): Promise<{ unlocked: number }> {
  if (!companyId) throw new Error("[Janus Lockout] companyId is required");

  const client = await getJanusClient();

  const { data, error } = await client
    .from("users")
    .update({ mg_access: true })
    .eq("company_id", companyId)
    .select("id");

  if (error) {
    console.error(`[Janus Lockout] Failed to unlock company ${companyId}:`, error.message);
    throw error;
  }

  const unlocked = data?.length ?? 0;
  console.log(`🔓 [Janus Lockout] Unlocked ${unlocked} users for company ${companyId}`);
  return { unlocked };
}
