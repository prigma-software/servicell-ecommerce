"use client"

import { useCart } from "@/shared/components/CartProvider"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createOrder } from "@/features/orders/actions/checkoutActions"
import { getWompiIntegritySignature } from "@/features/orders/actions/wompiActions"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Clock, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { useCheckoutSetup } from "@/hooks/useCheckoutSetup"
import { useStockReservation } from "@/hooks/useStockReservation"
import { ShippingInfoForm } from "@/components/checkout/ShippingInfoForm"
import { OrderSummary } from "@/components/checkout/OrderSummary"
import { BlockedItemsAlert } from "@/components/checkout/BlockedItemsAlert"
import { PriceChangeAlert } from "@/components/checkout/PriceChangeAlert"
import { wompiPublicKey, wompiWidgetDefaults } from "@/lib/constants/checkout"
import { createClient } from "@/lib/supabase/client"
import type { WompiResult } from "@/types/checkout.types"
import { storeBranding } from "@/lib/constants/branding-store"

export default function CheckoutPage() {
  const { items, total, clearCart, revalidateCart, hasBlockedItems, itemStatuses } = useCart()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  
  const isWompiEnabled = storeBranding.features?.payments?.wompi ?? true
  const isManualEnabled = storeBranding.features?.payments?.manual ?? true
  const defaultPayment = isWompiEnabled ? 'wompi' : (isManualEnabled ? 'manual' : 'wompi')
  
  const [paymentMethod, setPaymentMethod] = useState<'wompi' | 'manual'>(defaultPayment)

  const { zones, nombre, email, direccion, telefono, setNombre, setDireccion, setTelefono } = useCheckoutSetup()

  const { reservationId, reservationExpiresAt, isReserving, reservationError, reserveStock, cancelReservation } = useStockReservation(
    items,
    hasBlockedItems
  )

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login?redirect=/checkout')
      } else {
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    const validateBeforeCheckout = async () => {
      setIsValidating(true)
      await revalidateCart()
      setIsValidating(false)
    }
    validateBeforeCheckout()
  }, [revalidateCart])

  // El useEffect que reservaba el stock automáticamente se eliminó.
  // Ahora el stock se reserva/descuenta al momento de darle a Confirmar/Comprar.

  const selectedZone = useMemo(() => zones.find((z) => z.id === selectedZoneId) || null, [zones, selectedZoneId])

  const shippingCost = useMemo(() => {
    if (!selectedZone) return 0
    if (selectedZone.free_threshold > 0 && total >= selectedZone.free_threshold) return 0
    return selectedZone.cost
  }, [selectedZone, total])

  const grandTotal = useMemo(() => total + shippingCost, [total, shippingCost])

  const isManualAllowed = selectedZone?.manual_payment_allowed ?? false
  const manualZones = useMemo(() => zones.filter(z => z.manual_payment_allowed).map(z => z.name).join(", "), [zones])

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (hasBlockedItems) {
      setError("Hay productos en tu carrito que no están disponibles. Por favor, revisa tu carrito.")
      return
    }

    if (!selectedZoneId) {
      setError("Por favor selecciona una ciudad de envío.")
      return
    }
    
    if (!telefono) {
      setError("Por favor ingresa un número de teléfono.")
      return
    }

    if (paymentMethod === 'manual' && !isManualAllowed) {
      setError("El pago manual no está disponible para la zona de envío seleccionada.")
      return
    }

    if (items.length === 0) return

    if (paymentMethod === 'wompi' && typeof (window as unknown as { WidgetCheckout?: unknown }).WidgetCheckout !== 'function') {
      setError("La pasarela de pago Wompi aún no ha cargado o fue bloqueada por tu navegador. Por favor desactiva bloqueadores de anuncios o recarga la página.")
      return
    }

    setLoading(true)
    setError("")
    let activeReservationId: string | null = reservationId
    try {
      if (paymentMethod === 'wompi') {
        const newReservationId = await reserveStock(
          items.map((item) => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
          }))
        )
        if (!newReservationId) {
          setError(reservationError || "No se pudo reservar el stock. Es posible que los productos se hayan agotado.")
          setLoading(false)
          return
        }
        activeReservationId = newReservationId
      }

      const orderId = await createOrder(
        items.map((i) => ({
          id: i.id,
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity: i.quantity,
          name: i.name,
          price: i.price,
        })),
        total,
        nombre,
        telefono,
        direccion,
        shippingCost,
        selectedZoneId || undefined,
        paymentMethod,
        activeReservationId || undefined
      )

      if (paymentMethod === 'manual') {
        clearCart()
        router.push("/checkout/success/manual")
        return
      }

      const amountInCents = Math.round(grandTotal) * 100
      const integritySignature = await getWompiIntegritySignature(orderId, amountInCents, "COP")

      let cleanPhone = telefono ? telefono.replace(/\D/g, "") : ""
      let phonePrefix = "+57"

      if (cleanPhone.startsWith("57") && cleanPhone.length === 12) {
        cleanPhone = cleanPhone.slice(2)
      } else if (telefono && telefono.trim().startsWith("+")) {
        const match = telefono.trim().match(/^(\+\d{1,3})\s*(.*)$/)
        if (match) {
          phonePrefix = match[1]
          cleanPhone = match[2].replace(/\D/g, "")
        }
      }

      const customerData: Record<string, unknown> = {
        email: email,
        fullName: nombre,
      }

      if (cleanPhone) {
        customerData.phoneNumber = cleanPhone
        customerData.phoneNumberPrefix = phonePrefix
      }

      const widgetConfig: Record<string, unknown> = {
        currency: wompiWidgetDefaults.currency,
        amountInCents,
        reference: orderId,
        publicKey: wompiPublicKey,
        redirectUrl: wompiWidgetDefaults.redirectUrl,
        customerData,
      }

      if (integritySignature) {
        widgetConfig.signature = { integrity: integritySignature }
      }

      const checkout = new ((window as unknown) as { WidgetCheckout: new (config: Record<string, unknown>) => { open: (callback: (result: WompiResult) => void) => void } }).WidgetCheckout(widgetConfig)

      checkout.open(async (result: WompiResult) => {
        const transaction = result.transaction

        if (transaction.status === "APPROVED" && activeReservationId) {
          await fetch("/api/cart/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reservation_id: activeReservationId }),
          }).catch(console.error)
          clearCart()
        } else if (activeReservationId && transaction.status !== "APPROVED") {
          await fetch("/api/cart/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reservation_id: activeReservationId }),
          }).catch(console.error)
        }

        router.push(`/checkout/result?id=${transaction.id}&status=${transaction.status}`)
      })
    } catch (err: unknown) {
      if (activeReservationId) {
        cancelReservation(activeReservationId)
      }
      const messageText = err instanceof Error 
        ? err.message 
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as { message: unknown }).message)
          : typeof err === 'string'
            ? err
            : "Error al procesar el pedido. Por favor, intenta nuevamente."
      setError(messageText)
    } finally {
      setLoading(false)
    }
  }

  const problemItems = items.filter((item) => {
    const statusKey = item.variant_id || item.id
    const status = itemStatuses.get(statusKey)
    return status && status.status !== "valid"
  })

  const blockedItems = problemItems.filter((item) => {
    const statusKey = item.variant_id || item.id
    const status = itemStatuses.get(statusKey)
    return status?.status !== "price_changed"
  })

  const priceChangedItems = items.filter((item) => {
    const statusKey = item.variant_id || item.id
    const status = itemStatuses.get(statusKey)
    return status?.original_price && status?.current_price && status.original_price !== status.current_price
  })

  if (isCheckingAuth) {
    return (
      <div className="flex h-[50vh] items-center justify-center">Verificando sesión...</div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center mt-20 text-muted-foreground">
        Tu carrito está vacío.{" "}
        <Link href="/" className="text-primary font-medium hover:underline">
          Volver a la tienda
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-8 mb-20 px-4 sm:px-6 lg:px-80">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/cart" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-8 w-8" />
        </Link>
        <h1 className="text-3xl font-extrabold text-foreground">Checkout</h1>
      </div>

      {reservationExpiresAt && !reservationError && (
        <Alert className="mb-6 bg-success-muted border-success/30">
          <Clock className="h-4 w-4 text-success" />
          <AlertTitle className="text-success">Stock reservado</AlertTitle>
          <AlertDescription className="text-success/80">
            Tu stock está reservado por 15 minutos. Completa el pago antes de que expire.
          </AlertDescription>
        </Alert>
      )}

      {reservationError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error al reservar stock</AlertTitle>
          <AlertDescription>
            {reservationError} Por favor, recarga la página o intenta más tarde.
          </AlertDescription>
        </Alert>
      )}

      {isValidating && (
        <Alert className="mb-6 bg-info-muted border-info/30">
          <AlertTitle className="text-info">Validando disponibilidad...</AlertTitle>
          <AlertDescription className="text-info/80">
            Verificando stock de todos los productos antes de proceder.
          </AlertDescription>
        </Alert>
      )}

      {blockedItems.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No puedes proceder al pago</AlertTitle>
          <AlertDescription>
            Algunos productos en tu carrito no están disponibles.
          </AlertDescription>
        </Alert>
      )}

      <div className="bg-card shadow-sm border rounded-xl overflow-hidden p-8">
        <BlockedItemsAlert blockedItems={blockedItems} itemStatuses={itemStatuses} />
        <PriceChangeAlert priceChangedItems={priceChangedItems} itemStatuses={itemStatuses} />

        <form onSubmit={handlePayment}>
          <ShippingInfoForm
            zones={zones}
            nombre={nombre}
            email={email}
            direccion={direccion}
            telefono={telefono}
            selectedZoneId={selectedZoneId}
            onNombreChange={setNombre}
            onDireccionChange={setDireccion}
            onTelefonoChange={setTelefono}
            onZoneChange={setSelectedZoneId}
          />

          <div className="mt-8 mb-6">
            <h2 className="text-xl font-bold text-card-foreground mb-4">Método de Pago</h2>
            {(!isWompiEnabled && !isManualEnabled) ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Pagos no disponibles</AlertTitle>
                <AlertDescription>
                  Los métodos de pago están deshabilitados temporalmente. Por favor intenta más tarde o contacta al administrador.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {isWompiEnabled && (
                  <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="wompi"
                      checked={paymentMethod === 'wompi'}
                      onChange={() => setPaymentMethod('wompi')}
                      className="h-4 w-4 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="font-semibold">Pago en Línea (Wompi)</div>
                      <div className="text-sm text-muted-foreground">Tarjetas de crédito, PSE, Nequi, Daviplata</div>
                    </div>
                  </label>
                )}
                
                {isManualEnabled && (
                  <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="manual"
                      checked={paymentMethod === 'manual'}
                      onChange={() => setPaymentMethod('manual')}
                      className="h-4 w-4 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="font-semibold">Pago Contra Entrega / Transferencia</div>
                      <div className="text-sm text-muted-foreground">
                        {manualZones ? `Disponible en: ${manualZones}` : "No disponible en ninguna ciudad"}
                      </div>
                    </div>
                  </label>
                )}
              </div>
            )}
          </div>

          <OrderSummary
            items={items}
            total={total}
            shippingCost={shippingCost}
            selectedZone={selectedZone}
            itemStatuses={itemStatuses}
          />

          {error && <div className="mb-4 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">{error}</div>}
          
          {paymentMethod === 'manual' && selectedZoneId && !isManualAllowed && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Método de pago no disponible</AlertTitle>
              <AlertDescription>
                El pago contra entrega no está habilitado para la zona de envío seleccionada. Por favor, elige pago en línea o contacta al administrador.
              </AlertDescription>
            </Alert>
          )}

          <button
            type="submit"
            disabled={loading || hasBlockedItems || isValidating || isReserving || !nombre || !telefono || !selectedZoneId || !direccion || (paymentMethod === 'manual' && !isManualAllowed) || (!isWompiEnabled && !isManualEnabled)}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm mt-2"
          >
            {loading || isValidating 
              ? "Verificando..." 
              : isReserving
                ? "Reservando stock..."
                : !nombre
                  ? "Ingresa tu nombre"
                  : !telefono
                    ? "Ingresa un teléfono"
                    : !selectedZoneId 
                      ? "Selecciona una ciudad"
                      : !direccion
                        ? "Ingresa tu dirección"
                        : (!isWompiEnabled && !isManualEnabled)
                          ? "Pagos deshabilitados"
                          : paymentMethod === 'manual' 
                            ? (!isManualAllowed ? "Pago contra entrega no disponible" : "Confirmar Pedido Contra Entrega")
                            : "Proceder al Pago"}
          </button>

          {paymentMethod === 'wompi' && isWompiEnabled && (
            <p className="text-center text-xs text-muted-foreground mt-5">
              Serás redirigido a Wompi para completar tu pago de forma segura.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
