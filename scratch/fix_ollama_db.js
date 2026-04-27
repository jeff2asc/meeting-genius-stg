
const { createClient } = require('@supabase/supabase-js');

// These are from your current environment
const supabaseUrl = 'https://iehrlogqpsebhubbafxo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaHJsb2dxcHNlYmh1YmJhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTMzNjIsImV4cCI6MjA3NjQ2OTM2Mn0.f00dmQAb0jNDni5hB_8seuHJwz_S3skkepmc_fIrEOk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOllamaSettings() {
  console.log("🛠️ Updating Ollama settings in Database...");

  const settings = [
    { key: 'primary_llm', value: 'ollama' },
    { key: 'ollama_host', value: 'http://mgllm.asccreative.com:11434' },
    { key: 'primary_llm_model', value: 'llama3.2' },
    { key: 'ollama_api_key', value: '' } // Leave blank as per Gary's curl logs
  ];

  for (const setting of settings) {
    const { error } = await supabase
      .from('system_settings')
      .upsert({ 
        key: setting.key, 
        value: setting.value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.error(`❌ Failed to update ${setting.key}:`, error.message);
    } else {
      console.log(`✅ Updated ${setting.key} to: ${setting.value}`);
    }
  }

  console.log("\n🚀 Ollama is now the primary AI for Meeting Genius using Gary's new server.");
}

fixOllamaSettings();
