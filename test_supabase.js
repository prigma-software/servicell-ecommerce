const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error, count } = await client
    .from("orders")
    .select("*, profiles(email)", { count: "exact" })
    .range(0, 19);

  if (error) {
    console.error("SUPABASE ERROR:");
    console.error(error);
  } else {
    console.log("SUCCESS:");
    console.log("Count:", count);
    console.log("Data length:", data.length);
  }
}

test();
