import { GoogleGenerativeAI } from "@google/generative-ai";

// Hardcoded API key for MVP testing
const genAI = new GoogleGenerativeAI("AIzaSyAXYijSEmkPGwJ3AFVYJ9cEQRREMZ5k3Hc");

interface ExtractedTask {
  description: string;
  assigned_name: string | null;
  due_date: string | null;
  confidence: number;
}

interface TaskExtractionResult {
  tasks: ExtractedTask[];
}

/**
 * Extract tasks from transcript text using Gemini AI
 */
export async function extractTasksFromTranscript(
  transcriptText: string
): Promise<ExtractedTask[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    const prompt = `You are an AI assistant that extracts action items and tasks from meeting transcripts.

Analyze the following transcript and extract all action items, tasks, and follow-ups.

For each task, provide:
1. description: A clear, actionable description of the task
2. assigned_name: The name of the person assigned (if mentioned), otherwise null
3. due_date: The due date in YYYY-MM-DD format (if mentioned), otherwise null
4. confidence: A number between 0 and 1 indicating your confidence in this being a task

Return ONLY valid JSON in this exact format:
{
  "tasks": [
    {
      "description": "Follow up with contractor about elevator repair",
      "assigned_name": "John Smith",
      "due_date": "2024-02-15",
      "confidence": 0.95
    }
  ]
}

Guidelines:
- Only extract clear action items that require someone to do something
- Include both explicit assignments ("John will...") and implicit ones ("We need to...")
- Be specific in task descriptions
- If no person is mentioned, use null for assigned_name
- If no date is mentioned, use null for due_date
- Confidence should reflect how certain you are this is an actionable task

Transcript:
${transcriptText}

Return the JSON response:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean up the response text
    let jsonText = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/g, "");
    }

    // Parse JSON
    const parsed: TaskExtractionResult = JSON.parse(jsonText);

    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      console.warn("No tasks array in response:", parsed);
      return [];
    }

    // Filter and validate tasks
    const validTasks = parsed.tasks.filter(
      (task) =>
        task.description &&
        typeof task.description === "string" &&
        task.confidence >= 0.5 // Only return tasks with at least 50% confidence
    );

    return validTasks;
  } catch (error) {
    console.error("Error extracting tasks from transcript:", error);
    throw new Error("Failed to extract tasks from transcript");
  }
}

/**
 * Validate extracted tasks
 */
export function validateExtractedTask(task: any): task is ExtractedTask {
  return (
    typeof task === "object" &&
    task !== null &&
    typeof task.description === "string" &&
    task.description.length > 0 &&
    (task.assigned_name === null || typeof task.assigned_name === "string") &&
    (task.due_date === null || typeof task.due_date === "string") &&
    typeof task.confidence === "number" &&
    task.confidence >= 0 &&
    task.confidence <= 1
  );
}
