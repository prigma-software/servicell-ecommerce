"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { ShippingZone } from "@/features/cart/types/cart.types"

type UseCheckoutSetupReturn = {
  zones: ShippingZone[]
  nombre: string
  email: string
  direccion: string
  telefono: string
  setNombre: (v: string) => void
  setDireccion: (v: string) => void
  setTelefono: (v: string) => void
}

export function useCheckoutSetup(): UseCheckoutSetupReturn {
  const [zones, setZones] = useState<ShippingZone[]>([])
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [direccion, setDireccion] = useState("")
  const [telefono, setTelefono] = useState("")

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await fetch("/api/shipping/zones")
        if (response.ok) {
          const data = await response.json()
          setZones(data.zones || [])
        }
      } catch (err) {
        console.error("Failed to fetch shipping zones:", err)
      }
    }
    fetchZones()
  }, [])

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, address, phone")
          .eq("id", user.id)
          .single()
        if (profile) {
          const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ")
          if (fullName) setNombre(fullName)
          if (profile.address) setDireccion(profile.address)
          if (profile.phone) setTelefono(profile.phone)
        }
        if (user.email) setEmail(user.email)
      }
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://checkout.wompi.co/widget.js"
    script.async = true
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  return { zones, nombre, email, direccion, telefono, setNombre, setDireccion, setTelefono }
}
