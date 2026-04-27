const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://iehrlogqpsebhubbafxo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaHJsb2dxcHNlYmh1YmJhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTMzNjIsImV4cCI6MjA3NjQ2OTM2Mn0.f00dmQAb0jNDni5hB_8seuHJwz_S3skkepmc_fIrEOk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const tableName = process.argv[2] || 'companies';
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return;
  }

  if (data && data.length > 0) {
    console.log(`Columns in ${tableName} table:`, Object.keys(data[0]));
  } else {
    console.log(`No data in ${tableName} table to check columns.`);
  }
}

checkColumns();
