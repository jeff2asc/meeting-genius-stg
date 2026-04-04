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
 * Extract tasks from transcript text using OpenAI API directly via fetch
 */
export async function extractTasksFromTranscript(
  transcriptText: string,
  sections?: Section[],
  customApiKey?: string
): Promise<ExtractedTask[]> {
  const apiKey = customApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OpenAI API Key");
  }

  // Build topics list for the prompt
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

  const prompt = `
You are an AI assistant that analyzes meeting transcripts to extract action items, tasks, and decisions.

Given the following meeting transcript, identify all actionable tasks or decisions that were made.
For each task, extract:
1. "description": A clear description of the task or decision.
2. "assigned_name": The name of the person assigned to the task (if mentioned, otherwise null).
3. "due_date": The due date or timeline mentioned (if any, otherwise null. Use ISO format YYYY-MM-DD if possible, or verbatim string).
4. "confidence": A number from 0 to 1 indicating your confidence in this extraction.
5. "suggested_topic_id": If the task clearly relates to one of the available meeting topics, provide its ID. Otherwise, null.
6. "suggested_topic_title": The title of the suggested topic. Otherwise, null.
${topicsContext}

Return ONLY a JSON object with a single key "tasks" which is an array of objects matching this specific JSON structure:
{
  "tasks": [
    {
      "description": "string",
      "assigned_name": "string | null",
      "due_date": "string | null",
      "confidence": "number",
      "suggested_topic_id": "number | null",
      "suggested_topic_title": "string | null"
    }
  ]
}

Transcript:
"""
${transcriptText}
"""
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // Cost efficient model
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI API Error: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  try {
    const result = JSON.parse(content);
    if (!result.tasks || !Array.isArray(result.tasks)) {
      throw new Error("Invalid format from OpenAI: Missing tasks array");
    }
    return result.tasks;
  } catch (parseError) {
    console.error("OpenAI JSON Parse Error:", parseError, "Raw content:", content);
    throw new Error("Failed to parse JSON directly from OpenAI response");
  }
}
