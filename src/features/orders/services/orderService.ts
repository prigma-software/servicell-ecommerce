import { createClient } from "@/lib/supabase/server"
import {
  findOrders,
  findOrderById,
  findOrderItems,
  findOrdersForExport,
  findOrderStatus,
  insertOrder,
  insertOrderItems,
  updateOrderStatus as repoUpdateOrderStatus,
} from "@/features/orders/repositories/orderRepository"
import {
  findSkusByIds,
  findProductsByIds,
  incrementSkuStock,
  incrementProductStock,
} from "@/features/cart/repositories/stockRepository"
import type { OrderStatus, OrderFilters, PaginatedOrders, OrderWithRelations } from "@/features/orders/types/order.types"
import type { OrderItem } from "@/features/orders/types/order.types"
import { canTransitionOrder } from "./orderStatusTransitions"
import { createAuditLog } from "@/features/admin/services/auditService"

// ============================================
// READ
// ============================================

export async function getOrders(filters: OrderFilters): Promise<PaginatedOrders> {
  const client = await createClient()
  const { data, count } = await findOrders(client, filters)
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const total = count ?? 0

  return {
    orders: data as OrderWithRelations[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getOrderById(id: string): Promise<OrderWithRelations | null> {
  const client = await createClient()
  return findOrderById(client, id) as Promise<OrderWithRelations | null>
}

// ============================================
// STATUS UPDATE
// ============================================

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<{ success: boolean; error?: string }> {
  const client = await createClient()
  try {
    const currentOrder = await findOrderById(client, orderId)
    if (!currentOrder) {
      return { success: false, error: "Orden no encontrada." }
    }

    if (!canTransitionOrder(currentOrder.status, newStatus)) {
      return {
        success: false,
        error: `Transición no permitida de ${currentOrder.status} a ${newStatus}.`,
      }
    }

    await repoUpdateOrderStatus(client, orderId, newStatus)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ============================================
// STOCK ROLLBACK
// ============================================

/**
 * Iterates order items and increments stock back to each product/variant.
 * Atomic guard via stock_returned column ensures stock cannot be returned twice.
 */
export async function rollbackOrderStock(
  orderId: string,
  preloadedItems?: { product_id: string; variant_id: string | null; quantity: number }[]
): Promise<{ success: boolean; error?: string }> {
  const client = await createClient()

  // Guardián atómico de duplicación
  const { data, error } = await client
    .from('orders')
    .update({ stock_returned: true })
    .eq('id', orderId)
    .eq('stock_returned', false)
    .select('id')

  if (error) {
    console.error("Error updating stock_returned:", error)
    return { success: false, error: "Database error during rollback" }
  }

  // Si ya se devolvió el stock previamente, no duplicamos
  if (!data || data.length === 0) {
    return { success: true }
  }

  const items = preloadedItems && preloadedItems.length > 0
    ? preloadedItems
    : await findOrderItems(client, orderId)

  if (!items || items.length === 0) {
    return { success: true }
  }

  // Ejecución paralela de incremento de stock
  await Promise.all(
    items.map(async (item) => {
      if (item.variant_id) {
        await incrementSkuStock(client, item.variant_id, item.quantity)
      } else {
        await incrementProductStock(client, item.product_id, item.quantity)
      }
    })
  )

  return { success: true }
}

/**
 * Cancels an order using the state machine, rolls back stock, records audit log.
 */
export async function cancelOrder(
  orderId: string,
  reason: string,
  adminUser?: { id: string; email: string }
): Promise<{ success: boolean; error?: string }> {
  if (!reason || reason.trim() === "") {
    return { success: false, error: "El motivo de cancelación es obligatorio." }
  }

  const client = await createClient()

  // Consulta ligera optimizada
  const { data: order, error: orderError } = await client
    .from("orders")
    .select("id, status, total_amount, customer_email, customer_name, payment_method, order_items(product_id, variant_id, quantity)")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    return { success: false, error: "Orden no encontrada." }
  }

  // 1. Validar con la Máquina de Estados
  if (!canTransitionOrder(order.status as OrderStatus, "DECLINED")) {
    return {
      success: false,
      error: `No se puede cancelar una orden que ya está en estado ${order.status}.`,
    }
  }

  // 2. Revertir stock en paralelo si aún no ha sido devuelto
  const items = (order.order_items || []) as { product_id: string; variant_id: string | null; quantity: number }[]
  const rollbackResult = await rollbackOrderStock(orderId, items)
  if (!rollbackResult.success) {
    return { success: false, error: rollbackResult.error || "Error al revertir stock" }
  }

  // 3. Actualizar estado y metadatos de cancelación
  const { error: updateError } = await client
    .from("orders")
    .update({
      status: "DECLINED",
      is_paid: false,
      cancellation_reason: reason.trim(),
      cancelled_at: new Date().toISOString(),
      cancelled_by: adminUser?.id || null,
    })
    .eq("id", orderId)

  if (updateError) {
    console.error("Error updating order to DECLINED:", updateError)
    return { success: false, error: updateError.message }
  }

  // 4. Registrar Log de Auditoría (no bloqueante)
  createAuditLog(client, {
    user_id: adminUser?.id || null,
    user_email: adminUser?.email || null,
    action: "ORDER_CANCELLED",
    target_type: "order",
    target_id: orderId,
    reason: reason.trim(),
    metadata: {
      previous_status: order.status,
      total_amount: order.total_amount,
      customer_email: order.customer_email,
      customer_name: order.customer_name,
      payment_method: order.payment_method,
    },
  }).catch((err) => console.error("Error al registrar audit log:", err))

  return { success: true }
}

/**
 * Marks an approved order as paid/collected by delivery agent.
 */
export async function markOrderAsPaid(
  orderId: string,
  adminUser?: { id: string; email: string },
  paymentDetails?: {
    method: string
    amountReceived?: number
    changeAmount?: number
    payments?: { method: string; amount: number }[]
  }
): Promise<{ success: boolean; error?: string }> {
  const client = await createClient()
  const order = await findOrderById(client, orderId)
  if (!order) {
    return { success: false, error: "Orden no encontrada." }
  }

  if (order.status !== "APPROVED") {
    return { success: false, error: "Solo las órdenes aprobadas pueden marcarse como pagadas." }
  }

  const { error } = await client
    .from("orders")
    .update({ is_paid: true })
    .eq("id", orderId)

  if (error) {
    console.error("Error marking order as paid:", error)
    return { success: false, error: error.message }
  }

  const methodLabel = paymentDetails?.method ? paymentDetails.method.toUpperCase() : "EFECTIVO"
  let auditReason = `Pago contra entrega recaudado vía ${methodLabel}`
  if (paymentDetails?.amountReceived && paymentDetails.changeAmount !== undefined) {
    auditReason += ` (Recibido: $${paymentDetails.amountReceived.toLocaleString()}, Cambio: $${paymentDetails.changeAmount.toLocaleString()})`
  }

  createAuditLog(client, {
    user_id: adminUser?.id || null,
    user_email: adminUser?.email || null,
    action: "PAYMENT_COLLECTED",
    target_type: "order",
    target_id: orderId,
    reason: auditReason,
    metadata: {
      total_amount: order.total_amount,
      customer_email: order.customer_email || order.profiles?.email,
      customer_name: order.customer_name,
      payment_details: (paymentDetails as unknown as Record<string, unknown>) || { method: "efectivo" },
    },
  }).catch((err) => console.error("Error creando audit log de pago:", err))

  return { success: true }
}

/**
 * Verifies the order is PENDING, rolls back stock, then marks it as ERROR.
 */
export async function markOrderAsError(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const client = await createClient()

  const currentOrder = await findOrderStatus(client, orderId)
  if (currentOrder.status !== "PENDING") {
    return { success: false, error: `Order is not PENDING (current: ${currentOrder.status})` }
  }

  const rollback = await rollbackOrderStock(orderId)
  if (!rollback.success) {
    return rollback
  }

  await repoUpdateOrderStatus(client, orderId, "ERROR")
  return { success: true }
}

// ============================================
// EXPORT
// ============================================

export type CSVOrder = {
  id: string
  customer_name: string
  customer_email: string
  created_at: string
  status: string
  total_amount: number
  wompi_transaction_id: string | null
}

export async function getOrdersForExport(filters: OrderFilters): Promise<CSVOrder[]> {
  const client = await createClient()
  return findOrdersForExport(client, filters) as Promise<CSVOrder[]>
}

/**
 * Builds a UTF-8 BOM CSV string from order data (Excel-compatible).
 */
export async function exportOrdersToCSV(filters: OrderFilters): Promise<string> {
  const data = await getOrdersForExport(filters)
  if (!data || data.length === 0) return ""

  const BOM = "\uFEFF"
  const headers = ["ID", "Cliente", "Email", "Fecha", "Hora", "Estado", "Total (COP)", "Wompi ID"]
  const headerRow = headers.join(",")

  const rows = data.map((order) => {
    const d = new Date(order.created_at)
    return [
      order.id,
      `"${order.customer_name.replace(/"/g, '""')}"`,
      `"${order.customer_email.replace(/"/g, '""')}"`,
      d.toLocaleDateString("es-CO"),
      d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
      order.status,
      (order.total_amount / 100).toFixed(2),
      order.wompi_transaction_id ?? "",
    ].join(",")
  })

  return BOM + headerRow + "\n" + rows.join("\n")
}

// ============================================
// CHECKOUT — validate & create order
// ============================================

/**
 * Checks that all cart items have sufficient stock and are active/not archived.
 */
export async function validateStock(
  items: OrderItem[]
): Promise<{ valid: boolean; insufficient: string[] }> {
  const client = await createClient()
  const insufficient: string[] = []

  const variantIds = items.filter((i) => i.variant_id).map((i) => i.variant_id!)
  const productIds = items.filter((i) => !i.variant_id).map((i) => i.product_id)

  const [skus, products] = await Promise.all([
    findSkusByIds(client, variantIds),
    findProductsByIds(client, productIds),
  ])

  const skuMap = new Map(skus.map((s) => [s.id, s]))
  const productMap = new Map(products.map((p) => [p.id, p]))

  for (const item of items) {
    if (item.variant_id) {
      const sku = skuMap.get(item.variant_id)
      if (!sku || !sku.active) { insufficient.push(item.id); continue }
      const parent = productMap.get(sku.product_id)
      if (parent?.archived) { insufficient.push(item.id); continue }
      if (sku.stock < item.quantity) insufficient.push(item.id)
    } else {
      const product = productMap.get(item.product_id)
      if (!product || !product.active || product.archived) { insufficient.push(item.id); continue }
      if (product.stock < item.quantity) insufficient.push(item.id)
    }
  }

  return { valid: insufficient.length === 0, insufficient }
}

/**
 * Validates prices server-side, verifies stock, creates the order and its items.
 * Returns the new order ID.
 */
export async function createOrder(
  items: OrderItem[],
  subtotalAmount: number,
  customerName: string,
  customerPhone: string,
  shippingAddress: string,
  shippingCost: number,
  shippingZoneId?: string,
  paymentMethod: 'wompi' | 'manual' = 'wompi',
  reservationId?: string
): Promise<string> {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()

  if (!user) throw new Error("Debes iniciar sesión para comprar")
  const userEmail = user.email
  if (!userEmail) throw new Error("No se encontró email del usuario")

  const variantIds = items.filter((i) => i.variant_id).map((i) => i.variant_id!)
  const productIds = items.filter((i) => !i.variant_id).map((i) => i.product_id)

  const [skus, products] = await Promise.all([
    findSkusByIds(client, variantIds),
    findProductsByIds(client, productIds),
  ])

  const skuMap = new Map(skus.map((s) => [s.id, s]))
  const productMap = new Map(products.map((p) => [p.id, p]))

  let calculatedSubtotal = 0

  for (const item of items) {
    if (item.variant_id) {
      const sku = skuMap.get(item.variant_id)
      if (!sku || !sku.active) throw new Error("Variante no disponible: " + item.name)
      const parent = productMap.get(sku.product_id)
      if (parent?.archived) throw new Error("Producto archivado: " + item.name)
      if (sku.stock < item.quantity) throw new Error("Stock insuficiente para: " + item.name)
      calculatedSubtotal += (sku.price_override ?? parent?.price ?? 0) * item.quantity
    } else {
      const product = productMap.get(item.product_id)
      if (!product || !product.active || product.archived) throw new Error("Producto no disponible: " + item.name)
      if (product.stock < item.quantity) throw new Error("Stock insuficiente para: " + item.name)
      calculatedSubtotal += product.price * item.quantity
    }
  }

  const tolerance = 1
  if (Math.abs(calculatedSubtotal - subtotalAmount) > tolerance) {
    throw new Error("El total no coincide con los precios actuales. Por favor actualiza tu carrito.")
  }

  const totalAmount = calculatedSubtotal + shippingCost

  const orderItemsData = items.map((i) => {
    let priceAtPurchase = 0
    if (i.variant_id) {
      const sku = skuMap.get(i.variant_id)
      const parent = sku ? productMap.get(sku.product_id) : undefined
      priceAtPurchase = sku?.price_override ?? parent?.price ?? i.price
    } else {
      priceAtPurchase = productMap.get(i.product_id)?.price ?? i.price
    }
    return {
      product_id: i.product_id,
      variant_id: i.variant_id || null,
      quantity: i.quantity,
      price_at_purchase: priceAtPurchase,
    }
  })

  if (paymentMethod === 'manual') {
    const orderData = {
      user_id: user.id,
      total_amount: totalAmount,
      status: "PENDING_MANUAL",
      payment_method: paymentMethod,
      customer_name: customerName,
      customer_email: userEmail,
      customer_phone: customerPhone,
      shipping_address: shippingAddress,
      shipping_cost: shippingCost,
      shipping_zone_id: shippingZoneId || null,
    }

    const { data: newOrderId, error } = await client.rpc('create_manual_order_with_stock', {
      p_order_data: orderData,
      p_items: orderItemsData
    })

    if (error) {
      if (error.message.includes('STOCK_AGOTADO')) {
        throw new Error("Stock agotado al momento de transacción")
      }
      throw new Error(`Error creando orden manual: ${error.message}`)
    }

    return newOrderId as string
  }

  // Wompi Flow
  const order = await insertOrder(client, {
    user_id: user.id,
    total_amount: totalAmount,
    status: "PENDING",
    payment_method: paymentMethod,
    customer_name: customerName,
    customer_email: userEmail,
    customer_phone: customerPhone,
    shipping_address: shippingAddress,
    shipping_cost: shippingCost,
    shipping_zone_id: shippingZoneId || null,
    // @ts-expect-error - DB types are out of sync with migration
    reservation_id: reservationId || null
  })

  const orderItemsWithOrderId = orderItemsData.map((i) => ({
    ...i,
    order_id: order.id
  }))

  await insertOrderItems(client, orderItemsWithOrderId)
  return order.id
}
