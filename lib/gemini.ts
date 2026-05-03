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
  
  // Try models in order of preference
  const modelsToTry = [
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-flash-002",
    "gemini-2.0-flash",
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
      if (err.message.includes("quota") || err.message.includes("limit")) {
        // Wait and retry once if it's a quota issue
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
  const model = genAI.getGenerativeModel({ 
    model: customModel || "gemini-1.5-flash-latest",
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `Extract action items from this transcript as JSON: ${transcriptText}`;
  
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  try {
    const parsed = JSON.parse(text);
    return parsed.tasks || [];
  } catch (e) {
    console.error("Failed to parse JSON from Gemini", e);
    return [];
  }
}
