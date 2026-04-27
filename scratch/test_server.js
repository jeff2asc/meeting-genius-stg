
const { extractTasksFromTranscriptOllama } = require('../lib/ollama.ts');
const fs = require('fs');
const path = require('path');

// Mock process.env for the test script
process.env.OLLAMA_HOST = "http://mgllm.asccreative.com:11434";
process.env.OLLAMA_MODEL = "llama3.2";

async function runTest() {
    console.log("🧪 Testing Gary's Ollama Server...");
    console.log("📍 Host:", process.env.OLLAMA_HOST);
    
    try {
        const transcript = fs.readFileSync(path.join(__dirname, '../sample_transcript.txt'), 'utf8');
        
        console.log("📤 Sending transcript to Ollama...");
        const startTime = Date.now();
        
        // Directly test the upgraded extraction logic
        const tasks = await extractTasksFromTranscriptOllama(transcript, [
            { id: 1, title: "Roofing", topics: [{ id: 101, title: "Apex Roofing Quote" }] },
            { id: 2, title: "Landscaping", topics: [{ id: 201, title: "Garden Maintenance" }] }
        ]);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`\n✅ Success! (Took ${duration}s)`);
        console.log("--- Extracted Tasks ---");
        tasks.forEach((t, i) => {
            console.log(`${i + 1}. [${t.assigned_name || 'Unassigned'}] ${t.description}`);
            if (t.suggested_topic_title) console.log(`   Topic: ${t.suggested_topic_title}`);
        });
        
    } catch (error) {
        console.error("\n❌ Test Failed!");
        console.error(error.message);
    }
}

// Since lib/ollama.ts uses 'export' (ESM), and we are in a CommonJS context in this scratch script,
// we will just recreate the call logic for the test to avoid transpilation issues.
async function manualTest() {
    const host = "http://mgllm.asccreative.com:11434";
    const model = "llama3.2";
    const transcript = fs.readFileSync(path.join(__dirname, '../sample_transcript.txt'), 'utf8');

    const prompt = `Extract tasks from this transcript. Return ONLY JSON: {"tasks": [{"description": "...", "assigned_name": "..."}]} \n\nTranscript:\n${transcript}`;

    console.log("📤 Pinging Gary's server at mgllm.asccreative.com...");
    
    const response = await fetch(`${host}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false,
            format: "json"
        }),
    });

    if (response.ok) {
        const data = await response.json();
        console.log("\n✅ Server Responded!");
        console.log("Raw Response Snippet:", data.response.substring(0, 200));
    } else {
        console.log("❌ Server Error:", response.status);
    }
}

manualTest();
