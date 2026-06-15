const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://149.5.247.118:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODAxNjM3MDIsImV4cCI6MTkwNjMyOTYwMH0.vejeRs5Q4CZNuxGRd2kLXEFY6swGfA834-OfXRzm2Ak';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log('Testing inserting a user with null email...');
  const { data, error } = await supabase
    .from('users')
    .insert({
      name: 'Test Null Email User ' + Date.now(),
      email: null,
      password_hash: 'test',
      user_type: 'attendee',
      roles: ['attendee']
    })
    .select();

  if (error) {
    console.error('Error inserting null email user:', error);
  } else {
    console.log('Successfully inserted null email user:', data);
    // Cleanup
    const { error: delError } = await supabase
      .from('users')
      .delete()
      .eq('id', data[0].id);
    if (delError) console.error('Error deleting test user:', delError);
    else console.log('Successfully cleaned up test user.');
  }
}

run();
