// Polyfill for Promise.withResolvers (Node.js < 22)
if (typeof Promise.withResolvers === 'undefined') {
  (Promise as any).withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

export interface ExtractedTask {
  description: string;
  assigned_name: string | null;
  due_date: string | null;
  confidence: number;
  suggested_topic_id: number | null;
  suggested_topic_title: string | null;
}

interface Topic {
  id: number;
  title: string;
}

interface Section {
  id: number;
  title: string;
  topics: Topic[];
}

/**
 * Extract tasks from transcript text using Gemini REST API directly.
 * Automatically tries multiple models (1.5-flash, 1.5-flash-latest, 2.0-flash) 
 * to find one with available quota.
 */
export async function extractTasksFromTranscript(
  transcriptText: string,
  sections?: Section[],
  customApiKey?: string,
  customModel?: string
): Promise<ExtractedTask[]> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("Missing Gemini API Key");

  // Models to try in order of preference/likelihood of quota
  const modelsToTry = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-pro"
  ];

  // If the user provided a specific model, put it at the front of the list
  if (customModel && !modelsToTry.includes(customModel)) {
    modelsToTry.unshift(customModel);
  }

  // Build topics context for the prompt
  let topicsContext = "";
  if (sections && sections.length > 0) {
    topicsContext = "\n\nAvailable meeting topics:\n";
    sections.forEach((section) => {
      if (section.topics && section.topics.length > 0) {
        section.topics.forEach((topic) => {
          topicsContext += `- Topic ID ${topic.id}: "${topic.title}" (in section: ${section.title})\n`;
        });
      }
    });
  }

  const prompt = `You are an AI assistant that extracts action items and tasks from meeting transcripts.
Analyze the following transcript and extract all action items, tasks, and follow-ups.
${topicsContext}
Return ONLY valid JSON in this exact format:
{
  "tasks": [
    {
      "description": "Follow up with contractor about elevator repair",
      "assigned_name": "John Smith",
      "due_date": "2024-02-15",
      "confidence": 0.95,
      "suggested_topic_id": 123,
      "suggested_topic_title": "Elevator Maintenance"
    }
  ]
}

Transcript:
${transcriptText}

Return the JSON response:`;

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      console.log(`🤖 Trying Gemini model: ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      });

      if (response.status === 404 || response.status === 429) {
        const err = await response.json();
        console.warn(`⚠️ Model ${model} failed (${response.status}): ${err.error?.message || 'Unknown'}`);
        lastError = err.error?.message || `Error ${response.status}`;
        continue; // Try the next model
      }

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      if (!text) continue;

      let jsonText = text.trim();
      const jsonBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) jsonText = jsonBlockMatch[1].trim();

      const parsed = JSON.parse(jsonText);
      console.log(`✅ Extraction successful with model: ${model}`);
      return (parsed.tasks || []).filter((t: any) => t.description && t.confidence >= 0.5);

    } catch (err: any) {
      console.error(`❌ Error with model ${model}:`, err.message);
      lastError = err.message;
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

export function validateExtractedTask(task: any): task is ExtractedTask {
  return typeof task === "object" && !!task.description;
}
