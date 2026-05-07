
import { supabase } from '../lib/supabase'

async function checkSchema() {
  const { data, error } = await supabase
    .from('decisions')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error fetching decision:', error)
  } else {
    console.log('Decision columns:', Object.keys(data[0] || {}))
    console.log('Sample data:', data[0])
  }
}

checkSchema()
