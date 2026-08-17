"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ============================================
// TYPES
// ============================================

export type FilterPeriod = "day" | "week" | "month" | "quarter" | "6months" | "year" | "all" | "custom"

// ============================================
// PERIOD CALCULATION
// ============================================

/**
 * Calculate start and end dates based on filter period.
 * All periods end at the end of today (23:59:59) at most.
 * Future end dates are clamped to today.
 */
export async function calculatePeriodDates(
  filter: FilterPeriod,
  customStart?: Date,
  customEnd?: Date
): Promise<{ start: Date; end: Date }> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const getStartOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)

  let start: Date
  let end: Date

  switch (filter) {
    case "day":
      start = getStartOfDay(now)
      end = today
      break
    case "week":
      start = new Date(getStartOfDay(now))
      start.setDate(start.getDate() - 7)
      end = today
      break
    case "month":
      start = new Date(getStartOfDay(now))
      start.setDate(start.getDate() - 30)
      end = today
      break
    case "quarter":
      start = new Date(getStartOfDay(now))
      start.setMonth(start.getMonth() - 3)
      end = today
      break
    case "6months":
      start = new Date(getStartOfDay(now))
      start.setMonth(start.getMonth() - 6)
      end = today
      break
    case "year":
      start = new Date(getStartOfDay(now))
      start.setFullYear(start.getFullYear() - 1)
      end = today
      break
    case "all":
      start = new Date(2000, 0, 1) // reasonable epoch
      end = today
      break
    case "custom":
      start = customStart ? getStartOfDay(customStart) : getStartOfDay(now)
      end = customEnd ? new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate(), 23, 59, 59, 999) : today
      // Clamp end to today if it's in the future
      if (end > today) end = today
      break
    default:
      start = new Date(getStartOfDay(now))
      start.setDate(start.getDate() - 7)
      end = today
  }

  return { start, end }
}

// ============================================
// CHECK FUNCTIONS
// ============================================

/**
 * Count active (non-archived) products in a category
 */
export async function hasProducts(categoryId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("archived", false)

  if (error) throw new Error(error.message)
  return count ?? 0
}

// ============================================
// CREATE
// ============================================

export async function createCategory(formData: FormData) {
  const name = formData.get("name") as string
  const description = formData.get("description") as string

  const supabase = await createClient()
  const { error } = await supabase.from("categories").insert([{ name, description }])

  if (error) throw new Error(error.message)
  revalidatePath("/admin/categories")
}

// ============================================
// UPDATE
// ============================================

export async function updateCategory(formData: FormData) {
  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const description = formData.get("description") as string

  const supabase = await createClient()
  const { error } = await supabase.from("categories").update({ name, description }).eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/categories")
}

// ============================================
// DELETE
// ============================================

/**
 * Delete category ÔÇö only allowed if no active products exist.
 * Returns { success: true } or { error: string } if blocked.
 */
export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Check for active products in this category
  const productCount = await hasProducts(id)
  if (productCount > 0) {
    return {
      success: false,
      error: `No puedes eliminar esta categor├¡a porque tiene ${productCount} producto${productCount > 1 ? "s" : ""} activo${productCount > 1 ? "s" : ""}. Primero debes eliminar o mover los productos.`,
    }
  }

  const { error } = await supabase.from("categories").delete().eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/categories")
  return { success: true }
}

// ============================================
// DASHBOARD METRICS (Phase 2) ÔÇö Consolidated
// ============================================

export interface DashboardMetrics {
  totalRevenue: number
  onlineRevenue: number
  posRevenue: number
  posSalesCount: number
  onlineOrdersCount: number
  reservedStock: number
  bestSeller: {
    id: string
    name: string
    image_url: string | null
    total_sold: number
  } | null
}

/**
 * Get all dashboard metrics in a single server action.
 * Executes 4 DB queries in parallel (orders, pos_sales, stock_reservations, order_items).
 * Reduces network calls from 6 to 1.
 */
export async function getDashboardMetrics(start: Date, end: Date): Promise<DashboardMetrics> {
  const supabase = await createClient()

  const [
    ordersResult,
    posSalesResult,
    stockResult,
    bestSellerResult,
    onlineOrdersCountResult,
  ] = await Promise.all([
    // 1. Online orders revenue (APPROVED only with payment_method and is_paid)
    supabase
      .from("orders")
      .select("total_amount, payment_method, is_paid")
      .eq("status", "APPROVED")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),

    // 2. POS sales count + total
    supabase
      .from("pos_sales")
      .select("total")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),

    // 3. Reserved stock count (always current, not filtered)
    supabase
      .from("stock_reservations")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),

    // 4. Best selling product (APPROVED orders only)
    supabase
      .from("order_items")
      .select("quantity, products(id, name, image_url), orders!inner(status)")
      .eq("orders.status", "APPROVED")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),

    // 5. Online orders count (all statuses)
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
  ])

  if (ordersResult.error) throw new Error(ordersResult.error.message)
  if (posSalesResult.error) throw new Error(posSalesResult.error.message)
  if (stockResult.error) throw new Error(stockResult.error.message)
  if (bestSellerResult.error) throw new Error(bestSellerResult.error.message)
  if (onlineOrdersCountResult.error) throw new Error(onlineOrdersCountResult.error.message)

  // Calculate online revenue: only Wompi or manual with collected cash (is_paid === true)
  const onlineRevenue = (ordersResult.data ?? [])
    .filter((o: any) => o.payment_method === 'wompi' || o.is_paid === true)
    .reduce(
      (sum, o) => sum + (o.total_amount ?? 0),
      0
    )

  // Calculate POS revenue + count
  const posRevenue = (posSalesResult.data ?? []).reduce(
    (sum, p) => sum + Number(p.total ?? 0),
    0
  )
  const posSalesCount = posSalesResult.data?.length ?? 0
  const onlineOrdersCount = onlineOrdersCountResult.count ?? 0

  // Reserved stock (always current)
  const reservedStock = stockResult.count ?? 0

  // Best seller aggregation
  const productMap = new Map<string, { id: string; name: string; image_url: string | null; total_sold: number }>()

  for (const item of bestSellerResult.data ?? []) {
    const product = item.products as unknown as { id: string; name: string; image_url: string | null } | null
    if (!product) continue

    const existing = productMap.get(product.id)
    if (existing) {
      existing.total_sold += item.quantity ?? 0
    } else {
      productMap.set(product.id, {
        id: product.id,
        name: product.name,
        image_url: product.image_url,
        total_sold: item.quantity ?? 0,
      })
    }
  }

  const sortedProducts = Array.from(productMap.values()).sort((a, b) => b.total_sold - a.total_sold)
  const bestSeller = sortedProducts[0] ?? null

  return {
    totalRevenue: onlineRevenue + posRevenue,
    onlineRevenue,
    posRevenue,
    posSalesCount,
    onlineOrdersCount,
    reservedStock,
    bestSeller,
  }
}

// ============================================
// REVENUE BY DAY (Phase 3)
// ============================================

export interface RevenueDayData {
  day: string
  revenue: number
}

export interface RevenueByDayResult {
  online: RevenueDayData[]
  pos: RevenueDayData[]
}

/**
 * Get daily revenue breakdown for online orders and POS sales.
 * Fills in missing days with 0 revenue.
 */
export async function getRevenueByDay(
  start: Date,
  end: Date
): Promise<RevenueByDayResult> {
  const supabase = await createClient()

  const [ordersResult, posResult] = await Promise.all([
    // Online orders revenue by day (APPROVED only, with payment_method and is_paid)
    supabase
      .from("orders")
      .select("created_at, total_amount, payment_method, is_paid")
      .eq("status", "APPROVED")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),

    // POS sales revenue by day
    supabase
      .from("pos_sales")
      .select("created_at, total")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
  ])

  if (ordersResult.error) throw new Error(ordersResult.error.message)
  if (posResult.error) throw new Error(posResult.error.message)

  // Aggregate online revenue by day (only paid)
  const onlineMap = new Map<string, number>()
  for (const order of (ordersResult.data ?? []) as any[]) {
    if (order.payment_method !== 'wompi' && order.is_paid !== true) continue
    const day = new Date(order.created_at).toISOString().split("T")[0]
    onlineMap.set(day, (onlineMap.get(day) ?? 0) + (order.total_amount ?? 0))
  }

  // Aggregate POS revenue by day
  const posMap = new Map<string, number>()
  for (const sale of posResult.data ?? []) {
    const day = new Date(sale.created_at).toISOString().split("T")[0]
    posMap.set(day, (posMap.get(day) ?? 0) + Number(sale.total ?? 0))
  }

  // Generate all days in range with 0 for missing
  const allDays: RevenueDayData[] = []
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)

  while (current <= end) {
    const dayStr = current.toISOString().split("T")[0]
    allDays.push({
      day: dayStr,
      revenue: onlineMap.get(dayStr) ?? 0,
    })
    current.setDate(current.getDate() + 1)
  }

  // Generate POS days
  const posDays: RevenueDayData[] = []
  const posCurrent = new Date(start)
  posCurrent.setHours(0, 0, 0, 0)

  while (posCurrent <= end) {
    const dayStr = posCurrent.toISOString().split("T")[0]
    posDays.push({
      day: dayStr,
      revenue: posMap.get(dayStr) ?? 0,
    })
    posCurrent.setDate(posCurrent.getDate() + 1)
  }

  return { online: allDays, pos: posDays }
}

// ============================================
// ORDERS BY STATUS (Phase 4)
// ============================================

export interface OrderStatusCount {
  status: string
  count: number
}

/**
 * Get online orders count grouped by payment status.
 */
export async function getOrdersByStatus(
  start: Date,
  end: Date
): Promise<OrderStatusCount[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())

  if (error) throw new Error(error.message)

  // Aggregate by status
  const statusMap = new Map<string, number>()
  for (const order of data ?? []) {
    statusMap.set(order.status, (statusMap.get(order.status) ?? 0) + 1)
  }

  // Return ordered by status name for consistency
  return Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => a.status.localeCompare(b.status))
}

/**
 * Get POS sales count grouped by payment status.
 */
export async function getPOSSalesByStatus(
  start: Date,
  end: Date
): Promise<OrderStatusCount[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("pos_sales")
    .select("payment_status")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())

  if (error) throw new Error(error.message)

  const statusMap = new Map<string, number>()
  for (const sale of data ?? []) {
    statusMap.set(sale.payment_status, (statusMap.get(sale.payment_status) ?? 0) + 1)
  }

  return Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => a.status.localeCompare(b.status))
}

// ============================================
// SHIPPING ZONES CRUD
// ============================================

export async function getShippingZones() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("shipping_zones")
    .select("*")
    .order("position", { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function createShippingZone(formData: FormData) {
  const name = (formData.get("name") as string)?.trim()
  const costStr = formData.get("cost") as string
  const freeThresholdStr = formData.get("free_threshold") as string
  const manualPaymentAllowed = formData.get("manual_payment_allowed") === "true"

  if (!name || name.length === 0) {
    throw new Error("El nombre de la zona es requerido")
  }
  if (name.length > 100) {
    throw new Error("El nombre debe tener m├íximo 100 caracteres")
  }

  const cost = parseInt(costStr, 10)
  if (isNaN(cost) || cost < 0 || cost > 999999999) {
    throw new Error("El costo debe ser un n├║mero entre 0 y 999,999,999")
  }

  const freeThreshold = parseInt(freeThresholdStr, 10)
  if (isNaN(freeThreshold) || freeThreshold < 0 || freeThreshold > 999999999) {
    throw new Error("El umbral de env├¡o gratis debe ser un n├║mero entre 0 y 999,999,999")
  }

  const supabase = await createClient()
  const { error } = await supabase.from("shipping_zones").insert([{ name, cost, free_threshold: freeThreshold, manual_payment_allowed: manualPaymentAllowed }])

  if (error) throw new Error(error.message)
  revalidatePath("/admin/shipping")
}

export async function updateShippingZone(formData: FormData) {
  const id = formData.get("id") as string
  const name = (formData.get("name") as string)?.trim()
  const costStr = formData.get("cost") as string
  const freeThresholdStr = formData.get("free_threshold") as string
  const active = formData.get("active") === "true"
  const manualPaymentAllowed = formData.get("manual_payment_allowed") === "true"

  if (!name || name.length === 0) {
    throw new Error("El nombre de la zona es requerido")
  }
  if (name.length > 100) {
    throw new Error("El nombre debe tener m├íximo 100 caracteres")
  }

  const cost = parseInt(costStr, 10)
  if (isNaN(cost) || cost < 0 || cost > 999999999) {
    throw new Error("El costo debe ser un n├║mero entre 0 y 999,999,999")
  }

  const freeThreshold = parseInt(freeThresholdStr, 10)
  if (isNaN(freeThreshold) || freeThreshold < 0 || freeThreshold > 999999999) {
    throw new Error("El umbral de env├¡o gratis debe ser un n├║mero entre 0 y 999,999,999")
  }

  const supabase = await createClient()
  const { error } = await supabase.from("shipping_zones").update({ name, cost, free_threshold: freeThreshold, active, manual_payment_allowed: manualPaymentAllowed }).eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/shipping")
}

export async function deleteShippingZone(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("shipping_zones").delete().eq("id", id)

if (error) throw new Error(error.message)
  revalidatePath("/admin/shipping")
  return { success: true }
}
