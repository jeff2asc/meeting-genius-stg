
/**
 * Universal AI wrapper for task extraction using Ollama.
 * Now includes chunking for long transcripts and enhanced error recovery.
 */

interface ExtractedTask {
  description: string;
  assigned_name: string | null;
  due_date: string | null;
  confidence: number;
  suggested_topic_id: number | null;
  suggested_topic_title: string | null;
}

interface Section {
  id: number;
  title: string;
  topics: { id: number; title: string }[];
}

/**
 * Split transcript into chunks to avoid context window overflow
 * and ensure better focus on specific sections.
 */
function chunkTranscript(text: string, maxWords: number = 2000): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  
  return chunks;
}

export async function extractTasksFromTranscriptOllama(
  transcriptText: string,
  sections?: Section[],
  config?: {
    host?: string;
    model?: string;
    apiKey?: string;
  }
): Promise<ExtractedTask[]> {
  try {
    const host = config?.host || process.env.OLLAMA_HOST || "http://38.49.216.119:11434";
    const model = config?.model || process.env.OLLAMA_MODEL || "llama3.2";
    const apiKey = config?.apiKey || process.env.OLLAMA_API_KEY;

    console.log(`🚀 Starting task extraction with Ollama (${model}) at ${host}`);

    // 1. Prepare Topics Context
    let topicsContext = "";
    if (sections && sections.length > 0) {
      topicsContext = "\n\nAvailable meeting topics:\n";
      sections.forEach((section) => {
        section.topics?.forEach((topic) => {
          topicsContext += `- Topic ID ${topic.id}: "${topic.title}" (Section: ${section.title})\n`;
        });
      });
    }

    // 2. Chunk transcript if it's very long
    const chunks = chunkTranscript(transcriptText);
    const allTasks: ExtractedTask[] = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(`📝 Processing chunk ${i + 1}/${chunks.length}...`);
      
      const prompt = `You are a precision AI task extractor.
Analyze this PART (${i + 1}/${chunks.length}) of a meeting transcript and extract clear action items.

For each task, provide:
- description (string)
- assigned_name (string or null)
- due_date (YYYY-MM-DD or null)
- confidence (0-1)
- suggested_topic_id (integer from list or null)
- suggested_topic_title (string from list or null)
${topicsContext}

Return ONLY valid JSON in this format:
{
  "tasks": [
    {
      "description": "...",
      "assigned_name": "...",
      "due_date": "...",
      "confidence": 0.9,
      "suggested_topic_id": 123,
      "suggested_topic_title": "..."
    }
  ]
}

TRANSCRIPT PART:
${chunks[i]}

JSON Response:`;

      const response = await fetch(`${host}/api/generate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(apiKey && { "X-API-Key": apiKey }) // Added security header support
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false,
          format: "json", // Hard-enforce JSON mode
          options: {
            num_ctx: 32768, // Ensure a decent context window
            temperature: 0.1 // Lower temp for more consistent JSON
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama Server Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      let jsonText = data.response.trim();

      try {
        // Robust JSON Extraction (in case model is chatty)
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.tasks && Array.isArray(parsed.tasks)) {
            allTasks.push(...parsed.tasks.filter((t: any) => t.description && t.confidence > 0.4));
          }
        }
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse JSON from chunk ${i + 1}. Skipping chunk.`);
      }
    }

    console.log(`✅ Extraction complete. Total tasks found: ${allTasks.length}`);
    return allTasks;

  } catch (error: any) {
    console.error("❌ Ollama Extraction Error:", error.message);
    throw error;
  }
}
