import { extractTasksFromTranscript as googleGeminiExtract } from "./gemini";
import { extractTasksFromTranscriptOllama as customOllamaExtract } from "./ollama";
import { extractTasksFromTranscript as openaiExtract } from "./openai";

interface Topic {
  id: number;
  title: string;
}

interface Section {
  id: number;
  title: string;
  topics: Topic[];
}

interface ExtractedTask {
  description: string;
  assigned_name: string | null;
  due_date: string | null;
  confidence: number;
  suggested_topic_id: number | null;
  suggested_topic_title: string | null;
}

/**
 * Universal AI wrapper for task extraction.
 * Dynamically resolves LLM preference (Company override -> System Settings -> Env).
 */
export async function extractTasksFromTranscript(
  transcriptText: string,
  sections?: Section[],
  loggingContext?: { userId?: number; companyId?: number }
): Promise<ExtractedTask[]> {
  
  let primaryAi = process.env.PRIMARY_AI || "ollama";
  let llmApiKey: string | undefined = undefined;
  let llmModel: string | undefined = undefined;

  try {
     const { createClient } = await import("./supabase");
     const supabase = createClient();

     // 1. Check for company override first if we have context
     if (loggingContext?.companyId) {
        const { data: companyData } = await supabase
          .from("companies")
          .select("llm_provider, llm_api_key, llm_model")
          .eq("id", loggingContext.companyId)
          .single();
        
        if (companyData && companyData.llm_provider && companyData.llm_provider !== 'global') {
           primaryAi = companyData.llm_provider;
            if (companyData.llm_api_key) {
               llmApiKey = companyData.llm_api_key;
            }
            if (companyData.llm_model) {
               llmModel = companyData.llm_model;
            }
        } else {
           // Fallback to system settings if company is 'global' or unset
            const { data } = await supabase
              .from("system_settings")
              .select("key, value")
              .in("key", ["primary_llm", "primary_llm_model", "global_llm_api_key"]);
             
           if (data) {
             data.forEach(setting => {
                if (setting.key === 'primary_llm') primaryAi = setting.value;
                if (setting.key === 'primary_llm_model' && !llmModel) llmModel = setting.value;
                if (setting.key === 'global_llm_api_key' && !llmApiKey) llmApiKey = setting.value;
             });
           }
        }
     } else {
       // Only system settings (e.g. Master user uploading without company context)
        const { data } = await supabase
          .from("system_settings")
          .select("key, value")
          .in("key", ["primary_llm", "primary_llm_model", "global_llm_api_key"]);

       if (data) {
          data.forEach(setting => {
             if (setting.key === 'primary_llm') primaryAi = setting.value;
             if (setting.key === 'primary_llm_model') llmModel = setting.value;
             if (setting.key === 'global_llm_api_key' && !llmApiKey) llmApiKey = setting.value;
          });
       }
     }
  } catch (e) {
     console.error("Failed to read DB for primary_llm", e);
  }
  
  const startTime = Date.now();

  const logUsage = async (status: "success" | "failure", error?: any) => {
    if (loggingContext?.userId || loggingContext?.companyId) {
      const { logLlmUsage } = await import("./logging");
      await logLlmUsage({
        user_id: loggingContext.userId,
        company_id: loggingContext.companyId,
        action_type: "llm_task_extraction",
        model_name: primaryAi === "openai" ? (llmModel || "openai-gpt-4o-mini") : (primaryAi === "gemini" ? (llmModel || "gemini-2.5-flash") : "ollama-llama3.2"),
        status,
        duration_ms: Date.now() - startTime,
        error_message: error ? (error?.message || String(error)) : undefined,
      });
    }
  };

  try {
    if (primaryAi === "openai") {
      console.log(`🌟 Extracting tasks with OpenAI (${llmModel || 'default-mini'})...`);
      const result = await openaiExtract(transcriptText, sections, llmApiKey, llmModel);
      await logUsage("success");
      return result;
    } else if (primaryAi === "gemini") {
      console.log(`✨ Extracting tasks with Gemini (${llmModel || 'default-flash'})...`);
      const result = await googleGeminiExtract(transcriptText, sections, llmApiKey, llmModel);
      await logUsage("success");
      return result;
    } else {
      // Default to Ollama
      console.log("🚀 Extracting tasks with Ollama...");
      try {
        const result = await customOllamaExtract(transcriptText, sections);
        await logUsage("success");
        return result;
      } catch (ollamaError) {
        console.error("⚠️ Ollama failed, falling back to Gemini:", ollamaError);
        await logUsage("failure", ollamaError);
        
        // Auto-fallback
        console.log(`✨ Fallback: Extracting tasks with Gemini (${llmModel || 'default-flash'})...`);
        const result = await googleGeminiExtract(transcriptText, sections, llmApiKey, llmModel);
        // Only logging the fallback success using current timestamp logic. We can reuse logUsage by hacking primaryAi
        primaryAi = "gemini";
        await logUsage("success");
        return result;
      }
    }
  } catch (error: any) {
    console.error(`❌ ${primaryAi} failed:`, error);
    await logUsage("failure", error);
    throw error;
  }
}

