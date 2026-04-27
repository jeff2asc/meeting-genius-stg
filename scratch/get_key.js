const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://iehrlogqpsebhubbafxo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaHJsb2dxcHNlYmh1YmJhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTMzNjIsImV4cCI6MjA3NjQ2OTM2Mn0.f00dmQAb0jNDni5hB_8seuHJwz_S3skkepmc_fIrEOk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getApiKey() {
  const { data, error } = await supabase
    .from('companies')
    .select('llm_api_key, llm_provider')
    .not('llm_api_key', 'is', null)
    .limit(1);

  if (error) {
    console.error('Error fetching API key:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Provider:', data[0].llm_provider);
    console.log('API Key:', data[0].llm_api_key);
  } else {
    console.log('No API key found in companies table.');
  }
}

getApiKey();
