import { extractTasksFromTranscript as googleGeminiExtract } from "./gemini";
import { extractTasksFromTranscriptOllama as customOllamaExtract } from "./ollama";

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
 * Tries Ollama (Gary's server) first. 
 * Falls back to Google Gemini if Ollama fails or is disabled.
 */
export async function extractTasksFromTranscript(
  transcriptText: string,
  sections?: Section[]
): Promise<ExtractedTask[]> {
  const useOllama = process.env.PRIMARY_AI === "ollama";

  // If Ollama is preferred:
  if (useOllama) {
    try {
      console.log("🚀 Extracting tasks with Ollama (Llama 3.2)...");
      return await customOllamaExtract(transcriptText, sections);
    } catch (error) {
      console.error("⚠️ Ollama failed, falling back to Gemini:", error);
      // AUTO-FALLBACK:
      return await googleGeminiExtract(transcriptText, sections);
    }
  }

  // Otherwise, default to Gemini (our solid fallback):
  console.log("✨ Extracting tasks with Gemini...");
  return await googleGeminiExtract(transcriptText, sections);
}
