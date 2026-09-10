import { createClient } from "@supabase/supabase-js";

/**
 * Admin client for server-side operations that need service role.
 * Use this only in server actions - never expose to client.
 */
export async function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must only be called on the server");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
