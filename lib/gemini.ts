import "@/lib/polyfill";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  customApiKey?: string,
  customModel?: string
): Promise<string> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("Missing Gemini API Key");

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Try models in order of preference (updated June 2026)
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-latest",
  ];

  let lastError = "";

  for (const modelName of modelsToTry) {
    try {
      console.log(`🤖 [Official SDK] Trying model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: audioBase64
          }
        },
        { text: "Transcribe this audio verbatim. Output only the transcript." },
      ]);

      const response = await result.response;
      const text = response.text();
      
      if (text) {
        console.log(`✅ [Official SDK] Transcription successful with ${modelName}`);
        return text;
      }
    } catch (err: any) {
      console.error(`❌ [Official SDK] Error with ${modelName}:`, err.message);
      lastError = err.message;
      if (err.message.includes("404")) continue; // Try next model
      if (err.message.includes("503") || err.message.includes("Service Unavailable") || err.message.includes("high demand")) {
        console.log(`⏳ ${modelName} overloaded, trying next model...`);
        continue; // Try next model in list
      }
      if (err.message.includes("quota") || err.message.includes("limit")) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
    }
  }

  throw new Error(`All Gemini models failed via SDK. Last error: ${lastError}`);
}

// For backward compatibility with existing code
export async function extractTasksFromTranscript(
  transcriptText: string,
  sections?: any[],
  customApiKey?: string,
  customModel?: string
): Promise<any[]> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("Missing Gemini API Key");

  const genAI = new GoogleGenerativeAI(apiKey);

  // Try models in order — fall back if overloaded or unavailable
  // If a custom model is provided, try it first then fall back to defaults
  const defaultModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash-latest"]
  const modelsToTry = customModel
    ? [customModel, ...defaultModels.filter(m => m !== customModel)]
    : defaultModels

  const sectionsContext = sections && sections.length > 0
    ? `\n\nMeeting sections and topics:\n${sections.map(s => `Section: ${s.title}\n${s.topics?.map((t: any) => `  - Topic: ${t.title}`).join('\n') || ''}`).join('\n')}`
    : ''

  const prompt = `You are analyzing a meeting transcript to extract action items and tasks.

Extract all action items, tasks, and assignments from this transcript. For each task found, return:
- description: what needs to be done
- assigned_name: who is responsible (null if not specified)  
- due_date: deadline in YYYY-MM-DD format (null if not specified)
- confidence: 0.0 to 1.0 how confident you are this is a real task
- suggested_topic_id: null (leave as null)
- suggested_topic_title: the most relevant topic/section this belongs to (or null)

Return ONLY a JSON object with a "tasks" array. No other text.

Example: {"tasks": [{"description": "Send report to board", "assigned_name": "Sarah", "due_date": "2026-06-15", "confidence": 0.9, "suggested_topic_id": null, "suggested_topic_title": "Financial Report"}]}
${sectionsContext}

Transcript:
${transcriptText}`

  let lastError = ""
  for (const modelName of modelsToTry) {
    try {
      console.log(`🤖 [Gemini] Trying model: ${modelName} for task extraction...`)
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      })
      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      const parsed = JSON.parse(text)
      console.log(`✅ [Gemini] Task extraction successful with ${modelName}`)
      return parsed.tasks || []
    } catch (err: any) {
      console.error(`❌ [Gemini] Error with ${modelName}:`, err.message)
      lastError = err.message
      if (err.message.includes("404") ||
          err.message.includes("503") ||
          err.message.includes("Service Unavailable") ||
          err.message.includes("high demand")) {
        continue // Try next model
      }
      throw err // Non-retryable error
    }
  }

  throw new Error(`All Gemini models failed for task extraction. Last error: ${lastError}`)
}
