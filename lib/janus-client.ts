import { createClient } from '@supabase/supabase-js';

/**
 * Janus Supabase Client
 * 
 * This client provides DIRECT access to the Janus database using its service_role key.
 * Use this for high-performance data fetching, bypassing the sync HTTP routes.
 */

const janusUrl = process.env.JANUS_SUPABASE_URL || "https://ihldyefskzluuciaudmr.supabase.co";
const janusKey = process.env.JANUS_SUPABASE_SERVICE_ROLE_KEY || "sb_secret_ASCg7d7jJlE2K-3t9OSPFA_3N-O91Pa";

if (!janusUrl || !janusKey) {
  console.warn("⚠️ Janus Supabase credentials missing in environment variables.");
}

export const janusClient = createClient(janusUrl, janusKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

/**
 * Helper to fetch Janus tickets directly
 */
export async function fetchJanusTicketsDirect(companyId?: number | null) {
  let query = janusClient.from('tickets').select('*');
  
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
