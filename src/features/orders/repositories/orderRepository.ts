import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrderStatus, OrderFilters } from "@/features/orders/types/order.types"
import { sanitizeSearchTerm } from "@/shared/utils/security"

// ============================================
// READ
// ============================================

/**
 * Returns a paginated list of orders with optional status/search filters.
 */
export async function findOrders(
  client: SupabaseClient,
  filters: OrderFilters
) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const offset = (page - 1) * pageSize

  let query = client
    .from("orders")
    .select("*, profiles(email), shipping_zones(name)", { count: "exact" })

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status)
  }

  const sanitized = sanitizeSearchTerm(filters.search)
  if (sanitized !== "") {
    const searchTerm = `%${sanitized}%`
    query = query.or(
      `customer_name.ilike.${searchTerm},customer_email.ilike.${searchTerm},wompi_transaction_id.ilike.${searchTerm}`
    )
  }

  query = query.order("created_at", { ascending: false })
  query = query.range(offset, offset + pageSize - 1)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data, count }
}

/**
 * Returns a full order record with its items and related product/sku data.
 */
export async function findOrderById(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("orders")
    .select(`
      *,
      profiles(email),
      shipping_zones(name),
      order_items(
        id,
        product_id,
        variant_id,
        quantity,
        price_at_purchase,
        products(id, name, image_url),
        product_skus(id, sku_code)
      )
    `)
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw new Error(error.message)
  }

  return data
}

/**
 * Returns all orders for a specific user, ordered by date descending.
 */
export async function findOrdersByUserId(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("orders")
    .select("id, status, total_amount, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Returns all orders filtered by date range. Optionally filter by status.
 */
export async function findOrdersByDateRange(
  client: SupabaseClient,
  start: Date,
  end: Date,
  status?: string
) {
  let query = client
    .from("orders")
    .select("total_amount, created_at, status, payment_method, is_paid")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())

  if (status) {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Returns the total count of orders in a date range (all statuses).
 */
export async function countOrdersByDateRange(
  client: SupabaseClient,
  start: Date,
  end: Date
) {
  const { count, error } = await client
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())

  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Returns all order statuses in a date range for grouping.
 */
export async function findOrderStatusesByDateRange(
  client: SupabaseClient,
  start: Date,
  end: Date
) {
  const { data, error } = await client
    .from("orders")
    .select("status")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Returns order items with product info for best-seller calculation.
 */
export async function findOrderItemsWithProducts(
  client: SupabaseClient,
  start: Date,
  end: Date
) {
  const { data, error } = await client
    .from("order_items")
    .select("quantity, products(id, name, image_url), orders!inner(status)")
    .eq("orders.status", "APPROVED")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Returns order items for a specific order (product_id, variant_id, quantity).
 */
export async function findOrderItems(client: SupabaseClient, orderId: string) {
  const { data, error } = await client
    .from("order_items")
    .select("product_id, variant_id, quantity")
    .eq("order_id", orderId)

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Returns a full order with items, product names, and SKU codes.
 * Used for email confirmation after payment approval.
 */
export async function findOrderWithItemsForEmail(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("orders")
    .select(`
      id,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      total_amount,
      wompi_transaction_id,
      order_items (
        quantity,
        price_at_purchase,
        product_id,
        variant_id,
        products ( name ),
        product_skus ( sku_code )
      )
    `)
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw new Error(error.message)
  }

  return data
}

/**
 * Returns a lightweight order list for CSV export (no pagination).
 */
export async function findOrdersForExport(
  client: SupabaseClient,
  filters: OrderFilters
) {
  let query = client
    .from("orders")
    .select("id, customer_name, customer_email, created_at, status, total_amount, wompi_transaction_id")

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status)
  }

  const sanitized = sanitizeSearchTerm(filters.search)
  if (sanitized !== "") {
    const searchTerm = `%${sanitized}%`
    query = query.or(
      `customer_name.ilike.${searchTerm},customer_email.ilike.${searchTerm},wompi_transaction_id.ilike.${searchTerm}`
    )
  }

  query = query.order("created_at", { ascending: false })

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Returns PENDING orders created before the given cutoff time.
 * Used to detect orphaned orders that never received a Wompi response.
 */
export async function findPendingOrdersOlderThan(
  client: SupabaseClient,
  cutoffTime: string
) {
  const { data, error } = await client
    .from("orders")
    .select("id")
    .eq("status", "PENDING")
    .lt("created_at", cutoffTime)

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Returns PENDING_MANUAL orders created before the given cutoff time.
 */
export async function findPendingManualOrdersOlderThan(
  client: SupabaseClient,
  cutoffTime: string
) {
  const { data, error } = await client
    .from("orders")
    .select("id")
    .eq("status", "PENDING_MANUAL")
    .lt("created_at", cutoffTime)

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Returns the current status of a single order.
 */
export async function findOrderStatus(client: SupabaseClient, orderId: string) {
  const { data, error } = await client
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

// ============================================
// WRITE
// ============================================

/**
 * Inserts a new order record. Returns the created order.
 */
export async function insertOrder(
  client: SupabaseClient,
  orderData: {
    user_id: string
    total_amount: number
    status: string
    customer_name: string
    customer_email: string
    shipping_address: string
    shipping_cost: number
    shipping_zone_id?: string | null
    customer_phone?: string | null
    payment_method?: 'wompi' | 'manual'
  }
) {
  const { data, error } = await client
    .from("orders")
    .insert([orderData])
    .select()
    .single()

  if (error) throw new Error("Error creando orden: " + error.message)
  return data
}

/**
 * Inserts order item records for a given order.
 */
export async function insertOrderItems(
  client: SupabaseClient,
  items: {
    order_id: string
    product_id: string
    variant_id: string | null
    quantity: number
    price_at_purchase: number
  }[]
) {
  const { error } = await client.from("order_items").insert(items)
  if (error) throw new Error("Error insertando items: " + error.message)
}

/**
 * Updates the status (and optionally the Wompi transaction ID) of an order.
 */
export async function updateOrderStatus(
  client: SupabaseClient,
  orderId: string,
  status: OrderStatus | string,
  wompiTransactionId?: string
) {
  const payload: Record<string, unknown> = { status }
  if (wompiTransactionId !== undefined) {
    payload.wompi_transaction_id = wompiTransactionId
  }

  const { error } = await client
    .from("orders")
    .update(payload)
    .eq("id", orderId)

  if (error) throw new Error(error.message)
}

/**
 * Marks an order as ERROR only if it is currently PENDING (safe update).
 */
export async function markOrderAsError(client: SupabaseClient, orderId: string) {
  const { error } = await client
    .from("orders")
    .update({ status: "ERROR" })
    .eq("id", orderId)
    .eq("status", "PENDING")

  if (error) throw new Error(error.message)
}
