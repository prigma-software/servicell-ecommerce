const { loadEnvConfig } = require('@next/env');
loadEnvConfig('./', true);

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error, count } = await supabase
    .from("orders")
    .select("*, profiles(email)", { count: "exact" })
    .range(0, 19);
  
  if (error) {
    console.error("SUPABASE ERROR:", error.message);
  } else {
    console.log("SUCCESS, count:", count, "data length:", data.length);
  }
}
test();
