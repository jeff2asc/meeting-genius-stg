const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = './env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

async function test() {
  const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
  const res = await fetch(`${env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/?apikey=${env['SUPABASE_SERVICE_ROLE_KEY']}`);
  const schema = await res.json();
  
  const mtInfo = schema.definitions.meeting_transcripts;
  console.log("meeting_transcripts columns:", mtInfo ? Object.keys(mtInfo.properties) : 'not found');
  
  // also check sections sequence
  const { data, error } = await supabase.from('sections').select('id').order('id', {ascending: false}).limit(1);
  console.log("Max section id:", data);
}
test();
