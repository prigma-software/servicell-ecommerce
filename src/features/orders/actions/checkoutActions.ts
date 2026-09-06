"use server"

import { revalidatePath } from "next/cache"
import {
  validateStock as svcValidateStock,
  createOrder as svcCreateOrder,
} from "@/features/orders/services/orderService"
import { createClient } from "@/lib/supabase/server"
import { sendManualOrderCreatedEmail } from "@/features/orders/services/orderConfirmation"
import type { OrderItem } from "@/features/orders/types/order.types"

/**
 * Checks that all cart items have sufficient stock and are active/not archived.
 */
export async function validateStock(
  items: OrderItem[]
): Promise<{ valid: boolean; insufficient: string[] }> {
  return svcValidateStock(items)
}

/**
 * Creates an order directly from the checkout form, verifying stock one last time.
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
  const orderId = await svcCreateOrder(
    items,
    subtotalAmount,
    customerName,
    customerPhone,
    shippingAddress,
    shippingCost,
    shippingZoneId,
    paymentMethod,
    reservationId
  )

  if (paymentMethod === 'manual') {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    
    if (user?.email || customerPhone) {
      const emailData = {
        orderId,
        customerName,
        customerEmail: user?.email || "",
        customerPhone: customerPhone || null,
        shippingAddress,
        totalAmount: subtotalAmount + shippingCost,
        items: items.map(item => ({
          name: item.name || "Producto",
          quantity: item.quantity,
          price_at_purchase: item.price ?? 0,
          sku_code: item.variant_id ? "Variante" : null
        }))
      }
      
      // Await safely to ensure execution in serverless runtimes
      await sendManualOrderCreatedEmail(emailData)
    }
  }
  
  revalidatePath("/admin/orders")
  return orderId
}