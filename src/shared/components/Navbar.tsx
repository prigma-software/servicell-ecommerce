"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Shield,
  Layout,
  List,
  X,
  ShoppingBag,
  SignOut,
  Package,
} from "@phosphor-icons/react";
import { StoreLogo } from "@/components/branding/store-logo";
import { StoreName } from "@/components/branding/store-name";
import { logout } from "@/features/auth/actions/authActions";
import { Button } from "@/components/ui/button";
import CartIcon from "./CartIcon";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: ShoppingBag },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/about", label: "Nosotros", icon: User },
  { href: "/contact", label: "Contacto", icon: User },
] as const;

const scaleHover = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
} as const;

function Skeleton() {
  return (
    <motion.nav
      className="bg-card border-b sticky top-0 z-50"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-8 h-8 bg-accent rounded-lg"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <div className="w-20 h-5 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    </motion.nav>
  );
}

function UserActions({ role }: { role: string }) {
  const isAdmin = role === "administrador";

  return (
    <motion.div
      key="user-logged"
      className="flex items-center gap-3"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
    >
      <motion.div {...scaleHover}>
        <div className="hidden md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href={isAdmin ? "/admin" : "/profile/orders"}>
              {isAdmin ? (
                <Shield className="w-4 h-4" weight="fill" />
              ) : (
                <Layout className="w-4 h-4" weight="duotone" />
              )}
              {isAdmin ? "Admin" : "Mi Cuenta"}
            </Link>
          </Button>
        </div>
      </motion.div>

      <motion.form action={logout} {...scaleHover}>
        <div className="hidden md:flex">
          <Button type="submit" variant="destructive" size="sm">
            <SignOut className="w-4 h-4" weight="duotone" />
            Salir
          </Button>
        </div>
      </motion.form>
    </motion.div>
  );
}

export default function Navbar() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [role, setRole] = useState("cliente");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (data) setRole(data.role);
      }
    };
    init();
  }, []);

  if (!mounted) return <Skeleton />;

  return (
    <motion.nav
      className="bg-card/95 backdrop-blur-lg border-b border-border sticky top-0 z-50"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="flex justify-between min-h-[4rem] py-2 items-center">
          <div className="flex items-center gap-8">
            <motion.div {...scaleHover}>
              <Link href="/" className="flex items-center gap-2">
                <motion.div
                  whileHover={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <StoreLogo size="md" />
                </motion.div>
              </Link>
            </motion.div>

            <motion.div
              className="hidden md:flex items-center gap-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              {NAV_ITEMS.map((item) => (
                <motion.div key={item.href} {...scaleHover}>
                  <Button asChild size="sm">
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <div className="flex items-center gap-3">
            <CartIcon />

            <AnimatePresence mode="wait">
              {user ? (
                <UserActions role={role} />
              ) : (
                <motion.div
                  key="user-guest"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <motion.div {...scaleHover}>
                    <div className="hidden md:flex">
                      <Button asChild variant="default" size="sm">
                        <Link href="/login">
                          <User className="w-4 h-4" weight="bold" />
                          Iniciar Sesión
                        </Link>
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? (
                  <X className="w-6 h-6 text-card-foreground" weight="bold" />
                ) : (
                  <List className="w-6 h-6" weight="bold" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              className="md:hidden py-4 border-t border-border"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col gap-1 pb-2">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.div key={item.href} whileTap={{ scale: 0.95 }}>
                      <Button
                        asChild
                        className="w-full justify-start text-center"
                      >
                        <Link
                          href={item.href}
                          className="flex items-center gap-3 px-4 py-3 justify-center"
                        >
                          <Icon className="w-5 h-5" weight="duotone" />
                          {item.label}
                        </Link>
                      </Button>
                    </motion.div>
                  );
                })}

                {user && role === "administrador" && (
                  <motion.div whileTap={{ scale: 0.95 }} className="mt-2">
                    <Button asChild variant="default" className="w-full">
                      <Link
                        href="/admin"
                        className="flex items-center justify-center gap-2"
                      >
                        <Shield className="w-5 h-5" weight="fill" />
                        Admin
                      </Link>
                    </Button>
                  </motion.div>
                )}

                {user && role !== "administrador" && (
                  <motion.div whileTap={{ scale: 0.95 }} className="mt-2">
                    <Button asChild variant="ghost" className="w-full">
                      <Link
                        href="/profile/orders"
                        className="flex items-center justify-center gap-2"
                      >
                        <Layout className="w-5 h-5" weight="duotone" />
                        Mi Cuenta
                      </Link>
                    </Button>
                  </motion.div>
                )}

                {!user && (
                  <motion.div whileTap={{ scale: 0.95 }} className="mt-2">
                    <Button asChild variant="default" className="w-full">
                      <Link
                        href="/login"
                        className="flex items-center justify-center gap-2"
                      >
                        <User className="w-5 h-5" weight="bold" />
                        Iniciar Sesión
                      </Link>
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}
