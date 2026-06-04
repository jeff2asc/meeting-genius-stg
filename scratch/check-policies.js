const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://iehrlogqpsebhubbafxo.supabase.co';
const supabaseKey = 'sb_secret_QW6SVtBA6BrlGmEh9I8Wuw_ONE4CUJ4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('get_policies');
  if (error) {
    // try direct query if possible, but we might not have access to pg_policies from REST
    console.log("RPC failed, trying raw query");
    const { data: dbData, error: dbError } = await supabase.from('pg_policies').select('*').eq('tablename', 'objects');
    console.log(dbData, dbError);
  } else {
    console.log(data);
  }
}
check();
