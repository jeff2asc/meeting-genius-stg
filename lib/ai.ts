import { extractTasksFromTranscript as googleGeminiExtract, transcribeAudio as googleGeminiTranscribe } from "./gemini";
import { extractTasksFromTranscriptOllama as customOllamaExtract, transcribeAudioOllama } from "./ollama";
import { extractTasksFromTranscript as openaiExtract, transcribeAudio as openaiTranscribe } from "./openai";

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
  
  // Default to ollama; DB settings below are the source of truth
  let primaryAi = "ollama";

  let llmApiKey: string | undefined = undefined;
  let llmModel: string | undefined = undefined;
  let ollamaHost: string | undefined = undefined;

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
             console.log(`🏢 Loaded Company Settings - Provider: ${primaryAi}, Key: ${llmApiKey ? (llmApiKey as string).substring(0, 5) : 'NONE'}`);
         } else {
            // Fallback to system settings if company is 'global' or unset
             const { data } = await supabase
               .from("system_settings")
               .select("key, value")
               .in("key", ["primary_llm", "primary_llm_model", "global_llm_api_key", "ollama_host", "ollama_api_key"]);
              
            if (data) {
              data.forEach(setting => {
                 if (setting.key === 'primary_llm' && setting.value) primaryAi = setting.value;
                 if (setting.key === 'primary_llm_model' && setting.value) llmModel = setting.value;
                 if (setting.key === 'global_llm_api_key' && setting.value && !llmApiKey) llmApiKey = setting.value;
                 if (setting.key === 'ollama_host' && setting.value) ollamaHost = setting.value;
                 if (setting.key === 'ollama_api_key' && setting.value && !llmApiKey) llmApiKey = setting.value;
              });
            }
         }
      } else {
       // Only system settings (e.g. Master user uploading without company context)
        const { data } = await supabase
          .from("system_settings")
          .select("key, value")
          .in("key", ["primary_llm", "primary_llm_model", "global_llm_api_key", "ollama_host", "ollama_api_key"]);

       if (data) {
          data.forEach(setting => {
             if (setting.key === 'primary_llm' && setting.value) primaryAi = setting.value;
             if (setting.key === 'primary_llm_model' && setting.value) llmModel = setting.value;
             if (setting.key === 'global_llm_api_key' && setting.value && !llmApiKey) llmApiKey = setting.value;
             if (setting.key === 'ollama_host' && setting.value) ollamaHost = setting.value;
             if (setting.key === 'ollama_api_key' && setting.value && !llmApiKey) llmApiKey = setting.value;
          });
       }
       console.log(`📡 Final Resolved AI: ${primaryAi}, Key Prefix: ${llmApiKey ? (llmApiKey as string).substring(0, 5) : 'NONE'}`);
     }
  } catch (e) {
     console.error("Failed to read DB for primary_llm", e);
  }
  
  const startTime = Date.now();

  const logUsage = async (status: "success" | "failure", error?: any) => {
    console.log(`📊 AI Usage Log - Provider: ${primaryAi}, Status: ${status}, Error:`, error || 'none');
    if (loggingContext?.userId || loggingContext?.companyId) {
      try {
        const { logLlmUsage } = await import("./logging");
        await logLlmUsage({
          user_id: loggingContext.userId,
          company_id: loggingContext.companyId,
          action_type: "llm_task_extraction",
          model_name: primaryAi === "openai" ? (llmModel || "openai-gpt-4o-mini") : (primaryAi === "gemini" ? (llmModel || "gemini-1.5-flash") : "ollama-llama3.2"),
          status,
          duration_ms: Date.now() - startTime,
          error_message: error ? (error?.message || String(error)) : undefined,
        });
      } catch (logErr) {
        console.error("Failed to log usage to DB:", logErr);
      }
    }
  };

  try {
    console.log(`🤖 Attempting extraction with provider: ${primaryAi}, model: ${llmModel || 'default'}`);
    if (primaryAi === "openai") {
      console.log(`🌟 Extracting tasks with OpenAI (${llmModel || 'default-mini'})...`);
      const result = await openaiExtract(transcriptText, sections, llmApiKey, llmModel);
      await logUsage("success");
      return result;
    } else if (primaryAi === "gemini") {
      console.log(`✨ Extracting tasks with Gemini (${llmModel || 'default-flash'})...`);
      try {
        const result = await googleGeminiExtract(transcriptText, sections, llmApiKey, llmModel);
        await logUsage("success");
        return result;
      } catch (geminiError: any) {
        console.error("⚠️ Gemini failed, attempting fallback to OpenAI...", geminiError.message);
        
        // Fallback to OpenAI if Gemini fails
        if (process.env.OPENAI_API_KEY || llmApiKey) {
          try {
            console.log("✨ Fallback: Attempting extraction with OpenAI...");
            const result = await openaiExtract(transcriptText, sections, llmApiKey, llmModel);
            primaryAi = "openai";
            await logUsage("success");
            return result;
          } catch (openaiErr) {
            console.error("❌ Both Gemini and OpenAI fallback failed.");
          }
        }
        // If fallback wasn't possible or also failed, throw the original Gemini error
        throw geminiError;
      }
    } else if (primaryAi === "ollama") {
      // Default to Ollama
      console.log("🚀 Extracting tasks with Ollama...");
      try {
        const result = await customOllamaExtract(transcriptText, sections, {
          host: ollamaHost,
          model: llmModel,
          apiKey: llmApiKey
        });
        await logUsage("success");
        return result;
      } catch (ollamaError) {
        console.error("⚠️ Ollama failed, attempting fallback...", ollamaError);
        await logUsage("failure", ollamaError);
        
        // Try OpenAI first
        if (process.env.OPENAI_API_KEY || llmApiKey) {
          try {
            console.log("✨ Attempting extraction with OpenAI...");
            const result = await openaiExtract(transcriptText, sections, llmApiKey, llmModel);
            primaryAi = "openai";
            await logUsage("success");
            return result;
          } catch (e) {
            console.error("OpenAI failed, trying Gemini...", e);
          }
        }
        
        // Then try Gemini
        if (process.env.GEMINI_API_KEY || llmApiKey) {
          try {
            console.log("✨ Fallback: Attempting extraction with Google Gemini...");
            const result = await googleGeminiExtract(transcriptText, sections, llmApiKey, llmModel);
            primaryAi = "gemini";
            await logUsage("success");
            return result;
          } catch (geminiError: any) {
            console.error("❌ Gemini extraction failed:", geminiError);
            // If we get here, it means both OpenAI and Gemini failed
            throw new Error(`AI extraction failed. OpenAI: Quota exceeded. Gemini: ${geminiError.message || 'Unknown error'}`);
          }
        }

        throw new Error("No valid AI API keys (OpenAI or Gemini) were found in your settings.");
      }
    } else {
      throw new Error(`Unknown AI provider: ${primaryAi}`);
    }
  } catch (error: any) {
    console.error(`❌ ${primaryAi} failed:`, error);
    await logUsage("failure", error);
    throw error;
  }
}

/**
 * Universal AI wrapper for audio transcription.
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  loggingContext?: { userId?: number; companyId?: number }
): Promise<string> {
  const startTime = Date.now();
  
  let primaryAi = "gemini";
  let llmApiKey: string | undefined = undefined;
  let llmModel: string | undefined = undefined;
  let ollamaHost: string | undefined = undefined;

  try {
    const { createClient } = await import("./supabase");
    const supabase = createClient();

    // 1. Resolve Provider (same logic as task extraction)
    if (loggingContext?.companyId) {
      const { data: companyData } = await supabase
        .from("companies")
        .select("llm_provider, llm_api_key, llm_model")
        .eq("id", loggingContext.companyId)
        .single();
      
      if (companyData && companyData.llm_provider && companyData.llm_provider !== 'global') {
        primaryAi = companyData.llm_provider;
        llmApiKey = companyData.llm_api_key || undefined;
        llmModel = companyData.llm_model || undefined;
      } else {
        const { data: sysData } = await supabase
          .from("system_settings")
          .select("key, value")
          .in("key", ["primary_llm", "global_llm_api_key", "ollama_host", "ollama_api_key"]);
        
        if (sysData) {
          sysData.forEach(s => {
            if (s.key === 'primary_llm' && s.value) primaryAi = s.value;
            if (s.key === 'global_llm_api_key' && s.value) llmApiKey = s.value;
            if (s.key === 'ollama_host' && s.value) ollamaHost = s.value;
            if (s.key === 'ollama_api_key' && s.value && !llmApiKey) llmApiKey = s.value;
          });
        }
      }
    } else {
      // System-wide fallback logic
      const { data: sysData } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["primary_llm", "global_llm_api_key", "ollama_host", "ollama_api_key"]);
      
      if (sysData) {
        sysData.forEach(s => {
          if (s.key === 'primary_llm' && s.value) primaryAi = s.value;
          if (s.key === 'global_llm_api_key' && s.value) llmApiKey = s.value;
          if (s.key === 'ollama_host' && s.value) ollamaHost = s.value;
          if (s.key === 'ollama_api_key' && s.value && !llmApiKey) llmApiKey = s.value;
        });
      }
    }
  } catch (e) {
    console.error("Failed to read DB for transcription settings", e);
  }

  const logUsage = async (status: "success" | "failure", error?: any) => {
    if (loggingContext?.userId || loggingContext?.companyId) {
      try {
        const { logLlmUsage } = await import("./logging");
        await logLlmUsage({
          user_id: loggingContext.userId,
          company_id: loggingContext.companyId,
          action_type: "llm_transcription",
          model_name: primaryAi === "openai" ? "openai-whisper-1" : (llmModel || "gemini-1.5-flash"),
          status,
          duration_ms: Date.now() - startTime,
          error_message: error ? (error?.message || String(error)) : undefined,
        });
      } catch (logErr) {
        console.error("Failed to log transcription usage:", logErr);
      }
    }
  };

  try {
    let result: string;

    if (primaryAi === "openai") {
      console.log("🌟 Transcribing with OpenAI Whisper...");
      result = await openaiTranscribe(audioBase64, mimeType, llmApiKey);
    } else if (primaryAi === "ollama") {
      console.log("🚀 Attempting Ollama transcription...");
      try {
        result = await transcribeAudioOllama(audioBase64, mimeType, { host: ollamaHost, apiKey: llmApiKey });
      } catch (ollamaErr: any) {
        console.warn("⚠️ Ollama transcription failed or unsupported, falling back to Gemini:", ollamaErr.message);
        result = await googleGeminiTranscribe(audioBase64, mimeType, undefined, llmModel);
      }
    } else {
      console.log("✨ Transcribing with Gemini 1.5 Flash...");
      result = await googleGeminiTranscribe(audioBase64, mimeType, llmApiKey, llmModel);
    }

    await logUsage("success");
    return result;
  } catch (error: any) {
    console.error(`❌ Transcription failed with ${primaryAi}:`, error.message);
    await logUsage("failure", error);
    throw error;
  }
}


