"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { LicenseOverlay } from "@/shared/components/license/LicenseOverlay"
import type { MensajeResponse } from "@/shared/types/license.types"

type LicenseState = {
  blocked: boolean
  mensaje: MensajeResponse | null
}

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdminRoute = pathname?.startsWith("/admin")

  const [licenseState, setLicenseState] = useState<LicenseState>({
    blocked: false,
    mensaje: null,
  })

  useEffect(() => {
    // Only verify license on admin routes
    if (!isAdminRoute) return

    async function verificarLicencia() {
      try {
        const res = await fetch("/api/licencia/check")
        if (!res.ok) return

        const data = await res.json()
        setLicenseState({
          blocked: data.blocked,
          mensaje: data.mensaje,
        })
      } catch {
        // Silently fail - don't block on network error
      }
    }

    verificarLicencia()

    const interval = setInterval(verificarLicencia, 15 * 60 * 1000)

    return () => clearInterval(interval)
  }, [isAdminRoute])

  // Defense-in-depth: Never block outside admin routes
  if (licenseState.blocked && isAdminRoute) {
    const mensaje = licenseState.mensaje ?? {
      title: "LICENCIA INACTIVA",
      description: "Comunícate con PRIGMA para más información.",
      status: "cancelled",
    }
    return <LicenseOverlay mensaje={mensaje} />
  }

  return <>{children}</>
}
