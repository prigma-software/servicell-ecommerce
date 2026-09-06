import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "@/lib/utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment variable.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            // Apply secure and sameSite flags while preserving client readability for @supabase/ssr
            const secureOptions = {
              ...options,
              secure: process.env.NODE_ENV === "production",
              sameSite: options?.sameSite || ("lax" as const),
            };
            supabaseResponse.cookies.set(name, value, secureOptions);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  const isAdminPath = request.nextUrl.pathname.startsWith("/admin");
  const isAdminApiPath = request.nextUrl.pathname.startsWith("/api/admin");

  // Protect admin routes and admin API endpoints
  if (isAdminPath || isAdminApiPath) {
    if (!user) {
      if (isAdminApiPath) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Check role in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "administrador") {
      if (isAdminApiPath) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // General auth protection for user profile
  if (request.nextUrl.pathname.startsWith("/profile") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Set strict cache-control on private / admin routes to prevent caching of sensitive data
  if (isAdminPath || isAdminApiPath || request.nextUrl.pathname.startsWith("/profile")) {
    supabaseResponse.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, max-age=0, must-revalidate"
    );
  }

  return supabaseResponse;
}
