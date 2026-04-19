
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
 * Extract tasks from transcript text using Ollama (Llama 3.2)
 */
export async function extractTasksFromTranscriptOllama(
  transcriptText: string,
  sections?: Section[]
): Promise<ExtractedTask[]> {
  try {
    const host = process.env.OLLAMA_HOST || "http://38.49.216.119:11434";
    const model = process.env.OLLAMA_MODEL || "llama3.2";

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

    const prompt = `You are an AI assistant that extracts action items and tasks from meeting transcripts.

Analyze the following transcript and extract all action items, tasks, and follow-ups.

For each task, provide:
1. description: A clear, actionable description of the task
2. assigned_name: The name of the person assigned (if mentioned), otherwise null
3. due_date: The due date in YYYY-MM-DD format (if mentioned), otherwise null
4. confidence: A number between 0 and 1 indicating your confidence in this being a task
5. suggested_topic_id: The ID of the most relevant topic from the list below (if applicable), otherwise null
6. suggested_topic_title: The title of the suggested topic (if applicable), otherwise null
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

Guidelines:
- Return ONLY the JSON object. No intro, no explanation, no markdown blocks.
- Only extract clear action items that require someone to do something.
- Include both explicit assignments ("John will...") and implicit ones ("We need to...").
- Be specific in task descriptions.
- If no person is mentioned, use null for assigned_name.
- If no date is mentioned, use null for due_date.
- Try to match tasks to the most relevant topic from the available topics list.
- If no relevant topic exists, set suggested_topic_id and suggested_topic_title to null.

Transcript:
${transcriptText}

Return the JSON response:`;

    const response = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    let jsonText = data.response.trim();

    try {
      // Clean up markdown code blocks
      const jsonBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        jsonText = jsonBlockMatch[1].trim();
      }

      const parsed = JSON.parse(jsonText);

      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        console.warn("Ollama returned invalid structure:", jsonText);
        return [];
      }

      return parsed.tasks.filter(
        (task: any) => task.description && task.confidence >= 0.5
      );
    } catch (parseError) {
      console.error("Ollama JSON Parse Error:", parseError, "Raw content:", jsonText);
      
      // Attempt to find any JSON-like array in the text if full parse failed
      const arrayMatch = jsonText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        try {
          const tasks = JSON.parse(arrayMatch[0]);
          return Array.isArray(tasks) ? tasks : [];
        } catch (e) {
          // Fall through
        }
      }

      const snippet = jsonText.substring(0, 100);
      throw new Error(`AI response was not valid JSON. Started with: ${snippet}`);
    }
  } catch (error: any) {
    console.error("Error in Ollama extraction:", error);
    throw new Error(error.message || "Failed to extract tasks from transcript");
  }
}
