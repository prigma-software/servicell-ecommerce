import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/features/auth/types/user.types";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AdminUser extends AuthenticatedUser {
  role: "administrador";
}

/**
 * Asserts that the current session is authenticated.
 * Returns the user object if authenticated, or throws an Error.
 */
export async function assertAuthenticated(): Promise<AuthenticatedUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    throw new Error("Unauthorized");
  }

  return {
    id: user.id,
    email: user.email,
  };
}

/**
 * Asserts that the current session belongs to an administrator.
 * Throws "Unauthorized" if no user is logged in, or "Forbidden" if the user is not an administrator.
 * Returns the authenticated admin details.
 */
export async function assertAdmin(): Promise<AdminUser> {
  const user = await assertAuthenticated();
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile || (profile.role as UserRole) !== "administrador") {
    throw new Error("Forbidden");
  }

  return {
    id: user.id,
    email: user.email,
    role: "administrador",
  };
}
