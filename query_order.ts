import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "fs"

const envFile = existsSync(".env.local") ? ".env.local" : ".env"
const env = readFileSync(envFile, "utf8")
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1] || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]

const client = createClient(url!, key!)

async function main() {
  const { data, error } = await client
    .from("orders")
    .select("id, shipping_address, shipping_zone_id, shipping_zones(name), customer_phone, payment_method")
    .order("created_at", { ascending: false })
    .limit(5)
  console.log(JSON.stringify(data, null, 2))
}
main()
