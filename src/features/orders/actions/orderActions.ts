"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  getOrders,
  getOrderById,
  getOrdersForExport,
  exportOrdersToCSV,
  updateOrderStatus as svcUpdateOrderStatus,
  rollbackOrderStock as svcRollbackOrderStock,
  cancelOrder as svcCancelOrder,
  markOrderAsPaid as svcMarkOrderAsPaid,
  markOrderAsError as svcMarkOrderAsError,
  type CSVOrder as ServiceCSVOrder,
} from "@/features/orders/services/orderService"

export async function markOrderAsPaid(
  orderId: string,
  paymentDetails?: {
    method: string
    amountReceived?: number
    changeAmount?: number
    payments?: { method: string; amount: number }[]
  }
): Promise<{ success: boolean; error?: string }> {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  const adminUser = user ? { id: user.id, email: user.email || "" } : undefined

  const result = await svcMarkOrderAsPaid(orderId, adminUser, paymentDetails)
  if (result.success) {
    revalidatePath("/admin/orders")
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath("/admin/sales")
    revalidatePath("/admin")
  }
  return result
}
import { findAuditLogsByTarget, createAuditLog } from "@/features/admin/services/auditService"
import { sendOrderConfirmationEmail } from "@/features/orders/services/orderConfirmation"
import type {
  OrderStatus as OrderStatusType,
  OrderFilters as OrderFiltersType,
  PaginatedOrders as PaginatedOrdersType,
  OrderWithRelations as OrderWithRelationsType,
  AuditLog,
} from "@/features/orders/types/order.types"

export type CSVOrder = ServiceCSVOrder
export type OrderStatus = OrderStatusType
export type OrderFilters = OrderFiltersType
export type PaginatedOrders = PaginatedOrdersType
export type OrderWithRelations = OrderWithRelationsType

export { getOrders, getOrderById, getOrdersForExport, exportOrdersToCSV }

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<{ success: boolean; error?: string }> {
  const result = await svcUpdateOrderStatus(orderId, newStatus)
  if (result.success) {
    revalidatePath("/admin/orders")
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath("/admin/sales")
    revalidatePath("/admin")
  }
  return result
}

export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()

  const adminUser = user ? { id: user.id, email: user.email || "" } : undefined
  const result = await svcCancelOrder(orderId, reason, adminUser)

  if (result.success) {
    revalidatePath("/admin/orders")
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath("/admin/sales")
    revalidatePath("/admin")
  }
  return result
}

export async function approveManualOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const client = await createClient()
  const order = await getOrderById(orderId)
  if (!order || order.status !== "PENDING_MANUAL") {
    return { success: false, error: "Solo las órdenes en estado PENDING_MANUAL pueden ser aprobadas manualmente." }
  }

  const { data: { user } } = await client.auth.getUser()

  const result = await svcUpdateOrderStatus(orderId, "APPROVED")
  if (result.success) {
    await createAuditLog(client, {
      user_id: user?.id || null,
      user_email: user?.email || null,
      action: "ORDER_APPROVED",
      target_type: "order",
      target_id: orderId,
      reason: "Aprobación manual de compra contra entrega",
    })

    const customerEmail = order.customer_email || order.profiles?.email
    if (customerEmail) {
      const emailData = {
        orderId: order.id,
        customerName: order.customer_name || "Cliente",
        customerEmail,
        shippingAddress: order.shipping_address || "",
        totalAmount: order.total_amount,
        items: (order.order_items || []).map(item => ({
          name: item.products?.name || "Producto",
          quantity: item.quantity,
          price_at_purchase: item.price_at_purchase,
          sku_code: item.product_skus?.sku_code || null
        }))
      }
      sendOrderConfirmationEmail(emailData).catch(console.error)
    }

    revalidatePath("/admin/orders")
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath("/admin/sales")
    revalidatePath("/admin")
  }
  return result
}

export async function cancelManualOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  return cancelOrder(orderId, "Cancelación manual desde panel administrativo")
}

export async function rollbackOrderStock(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await svcRollbackOrderStock(orderId)
  if (result.success) {
    revalidatePath("/admin/orders")
    revalidatePath(`/admin/orders/${orderId}`)
  }
  return result
}

export async function markOrderAsError(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await svcMarkOrderAsError(orderId)
  if (result.success) {
    revalidatePath("/admin/orders")
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath("/admin/sales")
    revalidatePath("/admin")
  }
  return result
}

export async function getOrderAuditLogs(orderId: string): Promise<AuditLog[]> {
  const client = await createClient()
  return findAuditLogsByTarget(client, "order", orderId)
}