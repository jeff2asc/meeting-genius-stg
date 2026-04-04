import { createClient } from "./supabase";

export interface LlmLogData {
  user_id?: number | null;
  company_id?: number | null;
  action_type: string;
  model_name: string;
  status: "success" | "failure";
  duration_ms: number;
  error_message?: string;
}

/**
 * Logs LLM usage and performance to the audit_logs table.
 */
export async function logLlmUsage(data: LlmLogData) {
  try {
    const supabase = createClient();
    
    // We do not wait for this to finish unless necessary, 
    // to avoid blocking the main execution path.
    const { error } = await supabase.from("audit_logs").insert({
      user_id: data.user_id || null,
      company_id: data.company_id || null,
      action_type: data.action_type,
      model_name: data.model_name,
      status: data.status,
      duration_ms: data.duration_ms,
      error_message: data.error_message || null,
    });

    if (error) {
      console.error("Failed to log LLM usage:", error);
    }
  } catch (err) {
    console.error("Exception while logging LLM usage:", err);
  }
}
