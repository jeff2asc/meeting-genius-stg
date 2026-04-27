const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://iehrlogqpsebhubbafxo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaHJsb2dxcHNlYmh1YmJhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTMzNjIsImV4cCI6MjA3NjQ2OTM2Mn0.f00dmQAb0jNDni5hB_8seuHJwz_S3skkepmc_fIrEOk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data, error } = await supabase
    .from('sections')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error or table sections missing');
  } else {
    console.log('Columns in sections:', Object.keys(data[0] || {}));
  }

  const { data: attData, error: attError } = await supabase
    .from('section_attachments')
    .select('*')
    .limit(1);

  if (attError) {
    console.log('Table section_attachments is MISSING');
  } else {
    console.log('Table section_attachments EXISTS');
  }
}

checkTables();
