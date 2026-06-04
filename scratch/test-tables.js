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
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'users' });
  // Instead of RPC, let's just query a single user to see the ID type or just get it via Postgres REST
  const { data: users, error: err } = await supabase.from('users').select('id').limit(1);
  console.log("Users:", users);
  
  // also check if meeting_transcripts exists
  const { data: mt, error: mtErr } = await supabase.from('meeting_transcripts').select('id, uploaded_by').limit(1);
  console.log("meeting_transcripts:", mt, mtErr);
}
test();
