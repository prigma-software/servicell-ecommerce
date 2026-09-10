"use server"

import { createClient } from "@/lib/supabase/server"
import { signLicenseRequest } from "@/shared/utils/sign-request"
import type { LicenseStatus, VerifyResponse, MensajeResponse } from "@/shared/types/license.types"

const PRIGMA_URL = process.env.PRIGMA_URL
const LICENSE_KEY = process.env.LICENSE_KEY || ""

async function verificarLicenciaStatus(): Promise<VerifyResponse> {
  if (!LICENSE_KEY) {
    return { status: "cancelled", blocked: true }
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signLicenseRequest(LICENSE_KEY, timestamp)

    const res = await fetch(`${PRIGMA_URL}/api/license/verify`, {
      headers: {
        "x-license-key": LICENSE_KEY,
        "x-timestamp": String(timestamp),
        "x-signature": signature,
      },
    })

    if (!res.ok) {
      return { status: "cancelled", blocked: true }
    }

    const data = await res.json()
    const blocked = data.status === "suspended" || data.status === "cancelled"

    return {
      status: data.status as LicenseStatus,
      blocked,
    }
  } catch {
    return { status: "cancelled", blocked: true }
  }
}

async function obtenerMensajeLicencia(): Promise<MensajeResponse | null> {
  if (!LICENSE_KEY) return null

  try {
    const res = await fetch(`${PRIGMA_URL}/api/licencia/mensaje?key=${encodeURIComponent(LICENSE_KEY)}`)
    if (!res.ok) return null

    const data = await res.json()
    if (!data.blocked) return null

    let title = "LICENCIA INACTIVA"
    let description = data.message || "Comunícate con PRIGMA para más información."

    if (data.status === "suspended") {
      title = "PAGO NO REGISTRADO"
      description = data.message || "Tu licencia se encuentra suspendida. Comunícate con PRIGMA para renovar tu servicio."
    } else if (data.status === "cancelled") {
      title = "LICENCIA CANCELADA"
      description = data.message || "Tu licencia ha sido cancelada. Comunícate con PRIGMA para más información."
    }

    return { title, description, status: data.status }
  } catch {
    return null
  }
}

export async function verificarLicencia(): Promise<{
  blocked: boolean
  status: LicenseStatus
  mensaje: MensajeResponse | null
}> {
  const { blocked, status } = await verificarLicenciaStatus()
  const mensaje = blocked ? await obtenerMensajeLicencia() : null

  return { blocked, status, mensaje }
}

export async function getAdminLicenseStatus(): Promise<{
  isValid: boolean
  redirectToBlocked: boolean
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { isValid: false, redirectToBlocked: false }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "administrador") {
    return { isValid: false, redirectToBlocked: false }
  }

  const { blocked } = await verificarLicenciaStatus()
  return { isValid: true, redirectToBlocked: blocked }
}
