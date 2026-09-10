import Link from "next/link";
import { User, ShoppingBag, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    isAdmin = profile?.role === "administrador";
  }

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-8rem)] bg-secondary rounded-lg overflow-hidden border">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-card shadow-sm border-b md:border-b-0 md:border-r border-border shrink-0">
        <div className="p-6 border-b border-border hidden md:block">
          <h2 className="text-xl font-bold text-card-foreground">Mi Cuenta</h2>
        </div>
        <nav className="flex md:flex-col gap-2 p-4 overflow-x-auto md:overflow-visible">
          <Link
            href="/profile"
            className="flex items-center gap-3 px-4 py-2 text-card-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors whitespace-nowrap"
          >
            <User className="w-5 h-5" />
            Mis Datos
          </Link>
          <Link
            href="/profile/orders"
            className="flex items-center gap-3 px-4 py-2 text-card-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors whitespace-nowrap"
          >
            <ShoppingBag className="w-5 h-5" />
            Mis Compras
          </Link>
          {isAdmin && (
            <div className="md:pt-4 md:mt-4 md:border-t md:border-border">
              <Link
                href="/admin"
                className="flex items-center gap-3 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-md font-semibold transition-colors whitespace-nowrap"
              >
                <Shield className="w-5 h-5" />
                Panel Admin
              </Link>
            </div>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-8 overflow-auto">
        {children}
      </div>
    </div>
  );
}
