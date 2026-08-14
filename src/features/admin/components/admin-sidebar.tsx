"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SignOut, House } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions/authActions";
import { SIDEBAR_ITEMS } from "@/lib/constants/admin";
import { storeBranding } from "@/lib/constants/branding-store";
import { StoreLogo } from "@/components/branding/store-logo";
import { SidebarLink } from "./sidebar-link";

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 h-full min-h-[100dvh] bg-card shadow-sm border-r border-border flex flex-col">
      <Link href="/admin" className="p-6 border-b border-border flex justify-center hover:bg-muted/30 transition-colors">
        <StoreLogo size="md" />
      </Link>
      <nav className="p-4 space-y-1 flex-1">
        {SIDEBAR_ITEMS.filter(item => {
          if (item.featureFlag) {
            return storeBranding.features?.[item.featureFlag as keyof typeof storeBranding.features];
          }
          return true;
        }).map((item) => (
          <SidebarLink
            key={item.href}
            {...item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>
      <div className="p-4 border-t border-border space-y-2">
        <Link href="/">
          <Button variant="outline" className="w-full justify-start">
            <House className="w-5 h-5 mr-3" />
            Ir a la tienda
          </Button>
        </Link>
        <form action={logout}>
          <Button variant="destructive" type="submit" className="w-full justify-start">
            <SignOut className="w-5 h-5 mr-3" />
            Salir
          </Button>
        </form>
      </div>
    </div>
  );
}
