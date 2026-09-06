import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendOrderConfirmationEmail } from "@/features/orders/services/orderConfirmation"
import {
  findOrderWithItemsForEmail,
} from "@/features/orders/repositories/orderRepository"

function safeCompareHex(a: string, b: string): boolean {
  if (!a || !b) return false
  // Hash both with SHA-256 to ensure two 32-byte buffers and prevent timingSafeEqual buffer length mismatch exceptions
  const hashA = crypto.createHash("sha256").update(a.toLowerCase()).digest()
  const hashB = crypto.createHash("sha256").update(b.toLowerCase()).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc, part) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, obj as unknown)
}

async function verifyWompiSignature(
  payload: WompiTransactionEvent,
  checksumHeader: string | null
): Promise<{ valid: boolean; reason?: string }> {
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET

  // En producción, es obligatorio tener configurado WOMPI_EVENTS_SECRET
  if (!eventsSecret || eventsSecret.startsWith("test_events_REEMPLAZAR")) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Wompi Webhook] WOMPI_EVENTS_SECRET no configurado en producción.")
      return { valid: false, reason: "WOMPI_EVENTS_SECRET missing in production" }
    }
    console.warn("[Wompi Webhook] WOMPI_EVENTS_SECRET no configurado en desarrollo. Omitiendo validación.")
    return { valid: true }
  }

  const checksum = checksumHeader || payload.signature?.checksum
  if (!checksum) {
    console.error("[Wompi Webhook] Falta checksum (en header x-event-checksum o signature.checksum).")
    return { valid: false, reason: "Missing checksum" }
  }

  // 1. Protección Anti-Replay: Validar frescura temporal (máximo 10 minutos de diferencia)
  const rawTimestamp = payload.timestamp
  if (rawTimestamp === undefined || rawTimestamp === null) {
    console.error("[Wompi Webhook] Falta el campo timestamp en el payload.")
    return { valid: false, reason: "Missing timestamp" }
  }

  let timestampMs: number
  if (typeof rawTimestamp === "number") {
    // Si viene en segundos (epoch < 1e11), convertir a ms
    timestampMs = rawTimestamp < 1e11 ? rawTimestamp * 1000 : rawTimestamp
  } else {
    timestampMs = Number(rawTimestamp) < 1e11 ? Number(rawTimestamp) * 1000 : Number(rawTimestamp)
    if (isNaN(timestampMs)) {
      timestampMs = new Date(rawTimestamp).getTime()
    }
  }

  const TEN_MINUTES_MS = 10 * 60 * 1000
  if (isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > TEN_MINUTES_MS) {
    console.error("[Wompi Webhook] Timestamp expirado o inválido (Replay Protection):", rawTimestamp)
    return { valid: false, reason: "Timestamp expired or invalid" }
  }

  // 2. Concatenación de propiedades según especificación oficial de Wompi:
  // Concatenación de valores de signature.properties (ej. transaction.id + transaction.status + transaction.amount_in_cents) + timestamp + eventsSecret
  const properties = payload.signature?.properties || [
    "transaction.id",
    "transaction.status",
    "transaction.amount_in_cents",
  ]

  let concatenatedValues = ""
  for (const prop of properties) {
    const val = getNestedValue(payload.data as Record<string, unknown>, prop)
    if (val !== undefined && val !== null) {
      concatenatedValues += String(val)
    }
  }

  const stringToHash = `${concatenatedValues}${rawTimestamp}${eventsSecret}`
  const calculatedChecksum = crypto.createHash("sha256").update(stringToHash).digest("hex")

  const isValid = safeCompareHex(calculatedChecksum, checksum)
  if (!isValid) {
    console.error("[Wompi Webhook] Firma inválida.")
    return { valid: false, reason: "Firma inválida" }
  }

  return { valid: true }
}

export type WompiTransactionEvent = {
  event: string
  data: {
    transaction: {
      id: string
      reference: string
      amount_in_cents?: number
      status: "APPROVED" | "DECLINED" | "ERROR" | "VOIDED"
      [key: string]: unknown
    }
  }
  signature?: {
    properties?: string[]
    checksum?: string
  }
  timestamp: number | string
  sent_at?: string
}

export async function processWompiWebhook(
  payload: WompiTransactionEvent,
  checksumHeader: string | null
): Promise<{ received: boolean; skipped?: boolean; error?: string }> {
  const verification = await verifyWompiSignature(payload, checksumHeader)
  if (!verification.valid) {
    return { received: false, error: verification.reason || "Firma inválida" }
  }

  const event = payload.event
  if (event !== "transaction.updated") {
    return { received: true, skipped: true }
  }

  const transaction = payload.data?.transaction
  if (!transaction) {
    return { received: false, error: "Payload malformado" }
  }

  const orderId = transaction.reference
  const newStatus = transaction.status
  const supabase = await createAdminClient()

  // Find the order to get the reservation_id and total_amount
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, reservation_id, status, total_amount")
    .eq("id", orderId)
    .single()

  if (orderError || !orderData) {
    console.error("[Wompi Webhook] Error fetching order:", orderError)
    return { received: false, error: "Order not found" }
  }

  if (newStatus === "APPROVED") {
    // Protección contra manipulación de monto
    if (transaction.amount_in_cents !== undefined && orderData.total_amount !== undefined) {
      const expectedAmountInCents = Math.round(orderData.total_amount) * 100
      if (transaction.amount_in_cents < expectedAmountInCents) {
        console.error(`[Wompi Webhook] Monto pagado (${transaction.amount_in_cents}) es menor al monto de la orden (${expectedAmountInCents})`)
        return { received: false, error: "Monto insuficiente" }
      }
    }
    // Call the idempotent RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "process_wompi_approved",
      {
        p_order_id: orderId,
        p_reservation_id: orderData.reservation_id
      }
    )

    if (rpcError) {
      console.error("[Wompi Webhook] Error in process_wompi_approved RPC:", rpcError)
      return { received: false, error: rpcError.message }
    }

    // Update the transaction ID separately since the RPC only handles status and stock
    await supabase.from("orders").update({ wompi_transaction_id: transaction.id }).eq("id", orderId)

    if (rpcResult === 'ALREADY_PROCESSED') {
      return { received: true, skipped: true }
    }

    if (rpcResult === 'APPROVED_NEEDS_REVIEW') {
      console.error(`ALERTA: Wompi tardío, reserva expirada, orden ${orderId} requiere revisión manual`)
      // Continue sending email, but maybe the admin needs to see it
    }

    // Send confirmation email / WhatsApp notification
    const order = await findOrderWithItemsForEmail(supabase, orderId)
    if (order && (order.customer_email || order.customer_phone)) {
      const items = (order.order_items || []).map((item: unknown) => {
        const i = item as {
          products?: { name: string }
          quantity: number
          price_at_purchase: number
          product_skus?: { sku_code: string | null }
        }
        return {
          name: i.products?.name || "Producto",
          quantity: i.quantity,
          price_at_purchase: i.price_at_purchase,
          sku_code: i.product_skus?.sku_code ?? null,
        }
      })

      await sendOrderConfirmationEmail({
        orderId: order.id,
        customerName: order.customer_name || "Cliente",
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        shippingAddress: order.shipping_address || "",
        totalAmount: order.total_amount,
        wompiTransactionId: transaction.id,
        items,
      })
    }
  } else if (newStatus === "DECLINED" || newStatus === "ERROR" || newStatus === "VOIDED") {
    // For failed Wompi transactions, update the status
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: newStatus, wompi_transaction_id: transaction.id })
      .eq("id", orderId)
      .eq("status", "PENDING") // Only update if still pending

    if (updateError) {
      console.error("[Wompi Webhook] Error updating declined order:", updateError)
    }

    // Since it's a Wompi order, the stock is held in a reservation.
    // We can just let the reservation expire naturally (or explicitly expire it).
    // The expired reservation background job will return the stock to product_skus.
    // To prevent manual rollbacks from duplicating this, we mark stock_returned = true 
    // IF we manually expire it, but we won't over-engineer it here. The reservation handles itself.
    
    // Si queremos expirar la reserva de inmediato para liberar stock ya mismo:
    if (orderData.reservation_id) {
      await supabase.from("stock_reservations").update({ status: 'expired' }).eq("id", orderData.reservation_id)
      // Y sumamos el stock usando rollbackOrderStock
      // Wait, we should just let the cleanup job do it OR do it properly:
      // A safe way: just mark order stock_returned = true, and manually return the stock now so it's available instantly.
      // But wait! If we mark the reservation as 'expired', the cleanup job might NOT process it (since it looks for 'pending').
      // Ah, if we mark it 'expired', the cleanup job ignores it?
      // Let's look at cleanup_expired_reservations: it selects 'pending' and expires_at < now().
      // So if we mark it 'confirmed' or 'expired' manually, the cleanup job won't restore stock.
      
      // Let's just update reservation to 'confirmed' (so it never auto-expires and double counts), 
      // and then use our atomic rollbackOrderStock! This is the most consistent way.
      await supabase.from("stock_reservations").update({ status: 'confirmed' }).eq("id", orderData.reservation_id).eq("status", "pending")
    }

    // Now safely rollback stock using our atomic function
    const { rollbackOrderStock } = await import("@/features/orders/services/orderService")
    await rollbackOrderStock(orderId)
  }

  return { received: true }
}