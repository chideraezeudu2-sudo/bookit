require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const slug = '11ec789f-2ae4-4249-b95f-d33ceb9d9d52';
  console.log('Testing with slug:', slug);
  const { data, error } = await supabase.from('contractors').select('id, business_name, is_active').eq('id', slug).eq('is_active', true).single();
  console.log('Result:', data);
  console.log('Error:', error);
}
test().catch(console.error);
