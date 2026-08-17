"use client";

import { login } from "@/features/auth/actions/authActions";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useState } from "react";
import { StoreLogo } from "@/components/branding/store-logo";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div
      className="w-full max-w-md space-y-8 rounded-2xl bg-card p-10 shadow-2xl border border-border"
    >
      <div className="text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
          >
            <StoreLogo size="lg" />
          </motion.div>
        </Link>
        <h2 className="text-3xl font-bold tracking-tight text-card-foreground">
          Bienvenido de vuelta
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ingresa a tu cuenta para continuar
        </p>
      </div>

      {error && (
        <motion.div
          className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {error}
        </motion.div>
      )}

      <form action={login} className="mt-8 space-y-6" data-testid="login-form">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-card-foreground mb-2"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              aria-label="Correo electrónico"
              data-testid="email-input"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              placeholder="tu@correo.com"
            />
          </div>
          <div className="relative">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-card-foreground mb-2"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              aria-label="Contraseña"
              data-testid="password-input"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-12 text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              className="absolute right-4 top-10 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeSlash className="w-5 h-5" weight="bold" />
              ) : (
                <Eye className="w-5 h-5" weight="bold" />
              )}
            </button>
          </div>
          <div className="flex justify-end mt-2">
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        <div>
          <button
            type="submit"
            data-testid="login-submit-button"
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all border border-border cursor-pointer active:scale-[0.98]"
          >
            Iniciar Sesión
          </button>
        </div>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes una cuenta?{" "}
        <Link
          href="/register"
          className="font-medium text-foreground hover:text-primary transition-colors"
        >
          Regístrate aquí
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-muted/10 rounded-full blur-3xl" />
      </div>
      <Suspense
        fallback={
          <div className="w-full max-w-md p-10 text-center text-muted-foreground">
            Cargando...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
