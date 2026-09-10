"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LicenseProvider } from "@/shared/components/LicenseProvider";
import { LicenseOverlay } from "@/shared/components/license/LicenseOverlay";
import { MENSAJE_BLOQUEADO } from "@/lib/constants/admin";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { AdminFooter } from "@/features/admin/components/admin-footer";
import { AdminSkeleton } from "@/features/admin/components/admin-skeleton";
import { Button } from "@/components/ui/button";
import { List } from "@phosphor-icons/react";

function AdminContent({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const bloqueado = searchParams.get("bloqueado") === "si";
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsSidebarVisible(false);
  }, [pathname]);

  if (bloqueado) {
    return <LicenseOverlay mensaje={MENSAJE_BLOQUEADO} />;
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-transparent">
      <div className="hidden md:block">
        <AdminSidebar />
      </div>
      {isSidebarVisible ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            onClick={() => setIsSidebarVisible(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 h-full md:hidden">
            <AdminSidebar />
          </div>
        </>
      ) : null}
      <div
        className="flex-1 overflow-auto"
        onScroll={(event) => setIsScrolled(event.currentTarget.scrollTop > 0)}
      >
        <div className="pt-20 px-4 pb-8 md:p-8 min-h-full flex flex-col">
          {!isSidebarVisible ? (
            <Button
              variant="secondary"
              className={`fixed left-4 top-4 z-50 h-11 w-11 rounded-full p-0 shadow-md md:hidden transition-opacity ${
                isScrolled ? "opacity-60" : "opacity-100"
              }`}
              onClick={() => setIsSidebarVisible(true)}
              aria-label="Mostrar menu"
            >
              <List className="h-6 w-6" weight="bold" />
              <span className="sr-only">Mostrar menu</span>
            </Button>
          ) : null}
          <div className="flex-1">{children}</div>
          <AdminFooter />
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LicenseProvider>
      <Suspense fallback={<AdminSkeleton />}>
        <AdminContent>{children}</AdminContent>
      </Suspense>
    </LicenseProvider>
  );
}
