"use client"

import { useState, useEffect, useCallback, useRef } from "react"

type UseStockReservationReturn = {
  reservationId: string | null
  reservationExpiresAt: Date | null
  isReserving: boolean
  reservationError: string | null
  reserveStock: (items: { product_id: string; variant_id?: string; quantity: number }[]) => Promise<string | null>
  cancelReservation: (targetId?: string | null) => Promise<void>
}

export function useStockReservation(items: unknown[], hasBlockedItems: boolean): UseStockReservationReturn {
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [reservationExpiresAt, setReservationExpiresAt] = useState<Date | null>(null)
  const [isReserving, setIsReserving] = useState(false)
  const [reservationError, setReservationError] = useState<string | null>(null)
  const reservationIdRef = useRef<string | null>(null)

  const reserveStock = useCallback(
    async (items: { product_id: string; variant_id?: string; quantity: number }[]) => {
      if (items.length === 0 || hasBlockedItems) return null

      setIsReserving(true)
      setReservationError(null)

      try {
        const response = await fetch("/api/cart/reserve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        })

        if (response.ok) {
          const data = await response.json()
          reservationIdRef.current = data.reservation_id
          setReservationId(data.reservation_id)
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
          setReservationExpiresAt(expiresAt)
          return data.reservation_id as string
        } else {
          const data = await response.json().catch(() => ({}))
          setReservationError(data.error || "No se pudo reservar el stock.")
          return null
        }
      } catch (err) {
        console.error("Failed to reserve stock:", err)
        setReservationError("Error de conexión al reservar el stock.")
        return null
      } finally {
        setIsReserving(false)
      }
    },
    [hasBlockedItems]
  )

  const cancelReservation = useCallback(
    async (targetId?: string | null) => {
      const idToCancel = targetId || reservationIdRef.current || reservationId
      if (!idToCancel) return

      try {
        await fetch("/api/cart/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservation_id: idToCancel }),
        })
        if (idToCancel === reservationIdRef.current || idToCancel === reservationId) {
          reservationIdRef.current = null
          setReservationId(null)
          setReservationExpiresAt(null)
        }
      } catch (err) {
        console.error("Failed to cancel stock reservation:", err)
      }
    },
    [reservationId]
  )

  useEffect(() => {
    if (!reservationExpiresAt) return

    const handleBeforeUnload = () => {
      cancelReservation()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [reservationExpiresAt, cancelReservation])

  return { reservationId, reservationExpiresAt, isReserving, reservationError, reserveStock, cancelReservation }
}
