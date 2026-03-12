
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://iehrlogqpsebhubbafxo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaHJsb2dxcHNlYmh1YmJhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTMzNjIsImV4cCI6MjA3NjQ2OTM2Mn0.f00dmQAb0jNDni5hB_8seuHJwz_S3skkepmc_fIrEOk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const email = 'gacutanbri@gmail.com';
    const { data, error } = await supabase.from('users').select('email, company_id, name').eq('email', email).single();
    if (error) {
        console.error('User not found or error:', error.message);
    } else {
        console.log('User found:', JSON.stringify(data, null, 2));
        if (data.company_id) {
            const { data: company, error: compError } = await supabase.from('companies').select('name, smtp_host, smtp_user').eq('id', data.company_id).single();
            if (compError) {
                console.error('Company error:', compError.message);
            } else {
                console.log('Company found:', JSON.stringify(company, null, 2));
            }
        } else {
            console.log('User has NO company_id associated.');
        }
    }
}

checkUser();
