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
  console.log("Connecting to:", env['NEXT_PUBLIC_SUPABASE_URL']);
  const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
  
  console.log("Testing meeting_transcripts table...");
  const { data, error } = await supabase
    .from("meeting_transcripts")
    .select("*, users(name)")
    .limit(1);

  if (error) {
    console.error("ERROR from Supabase:", JSON.stringify(error, null, 2));
  } else {
    console.log("SUCCESS! Data:", data);
  }
}

test();
