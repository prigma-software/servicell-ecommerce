import { createClient } from "@/lib/supabase/server"
import {
  findOrdersByDateRange,
  countOrdersByDateRange,
  findOrderStatusesByDateRange,
  findOrderItemsWithProducts,
} from "@/features/orders/repositories/orderRepository"
import {
  findPosSalesByDateRange,
  findPosSalesStatusesByDateRange,
} from "@/features/pos/repositories/posRepository"
import { countActiveReservations } from "@/features/cart/repositories/stockRepository"

// ============================================
// Types
// ============================================

export type FilterPeriod =
  | "day" | "week" | "month" | "quarter" | "6months" | "year" | "all" | "custom"

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

export interface RevenueDayData { day: string; revenue: number }
export interface RevenueByDayResult { online: RevenueDayData[]; pos: RevenueDayData[] }
export interface OrderStatusCount { status: string; count: number }

// ============================================
// Period calculation
// ============================================

/**
 * Resolves start and end Date objects for a given filter period.
 * All periods end at the end of today (23:59:59). Future end dates are clamped.
 */
export async function calculatePeriodDates(
  filter: FilterPeriod,
  customStart?: Date,
  customEnd?: Date
): Promise<{ start: Date; end: Date }> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

  let start: Date
  let end: Date

  switch (filter) {
    case "day":
      start = startOfDay(now); end = today; break
    case "week":
      start = startOfDay(now); start.setDate(start.getDate() - 7); end = today; break
    case "month":
      start = startOfDay(now); start.setDate(start.getDate() - 30); end = today; break
    case "quarter":
      start = startOfDay(now); start.setMonth(start.getMonth() - 3); end = today; break
    case "6months":
      start = startOfDay(now); start.setMonth(start.getMonth() - 6); end = today; break
    case "year":
      start = startOfDay(now); start.setFullYear(start.getFullYear() - 1); end = today; break
    case "all":
      start = new Date(2000, 0, 1); end = today; break
    case "custom":
      start = customStart ? startOfDay(customStart) : startOfDay(now)
      end = customEnd
        ? new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate(), 23, 59, 59, 999)
        : today
      if (end > today) end = today
      break
    default:
      start = startOfDay(now); start.setDate(start.getDate() - 7); end = today
  }

  return { start, end }
}

// ============================================
// Dashboard metrics
// ============================================

/**
 * Fetches all dashboard KPIs in parallel (4 DB queries) and aggregates them.
 */
export async function getDashboardMetrics(start: Date, end: Date): Promise<DashboardMetrics> {
  const client = await createClient()

  const [onlineOrders, posSales, reservedStock, orderItems, onlineOrdersCount] = await Promise.all([
    findOrdersByDateRange(client, start, end, "APPROVED"),
    findPosSalesByDateRange(client, start, end),
    countActiveReservations(client),
    findOrderItemsWithProducts(client, start, end),
    countOrdersByDateRange(client, start, end),
  ])

  const onlineRevenue = onlineOrders
    .filter((o) => o.payment_method === 'wompi' || o.is_paid === true)
    .reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
  const posRevenue = posSales.reduce((sum, p) => sum + Number(p.total ?? 0), 0)
  const posSalesCount = posSales.length

  // Aggregate best-seller
  const productMap = new Map<string, { id: string; name: string; image_url: string | null; total_sold: number }>()

  for (const item of orderItems) {
    const product = item.products as unknown as { id: string; name: string; image_url: string | null } | null
    if (!product) continue
    const existing = productMap.get(product.id)
    if (existing) {
      existing.total_sold += item.quantity ?? 0
    } else {
      productMap.set(product.id, { id: product.id, name: product.name, image_url: product.image_url, total_sold: item.quantity ?? 0 })
    }
  }

  const bestSeller =
    Array.from(productMap.values()).sort((a, b) => b.total_sold - a.total_sold)[0] ?? null

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
// Revenue by day
// ============================================

/**
 * Aggregates daily revenue for online orders (APPROVED) and POS sales.
 * Fills missing days with 0.
 */
export async function getRevenueByDay(start: Date, end: Date): Promise<RevenueByDayResult> {
  const client = await createClient()

  const [onlineOrders, posSales] = await Promise.all([
    findOrdersByDateRange(client, start, end, "APPROVED"),
    findPosSalesByDateRange(client, start, end),
  ])

  const onlineMap = new Map<string, number>()
  for (const o of onlineOrders) {
    if (o.payment_method !== 'wompi' && o.is_paid !== true) continue
    const day = new Date(o.created_at).toISOString().split("T")[0]
    onlineMap.set(day, (onlineMap.get(day) ?? 0) + (o.total_amount ?? 0))
  }

  const posMap = new Map<string, number>()
  for (const s of posSales) {
    const day = new Date(s.created_at).toISOString().split("T")[0]
    posMap.set(day, (posMap.get(day) ?? 0) + Number(s.total ?? 0))
  }

  const buildDayArray = (map: Map<string, number>): RevenueDayData[] => {
    const result: RevenueDayData[] = []
    const cursor = new Date(start)
    cursor.setHours(0, 0, 0, 0)
    while (cursor <= end) {
      const day = cursor.toISOString().split("T")[0]
      result.push({ day, revenue: map.get(day) ?? 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    return result
  }

  return { online: buildDayArray(onlineMap), pos: buildDayArray(posMap) }
}

// ============================================
// Orders by status
// ============================================

/**
 * Groups online orders by status and returns counts sorted alphabetically.
 */
export async function getOrdersByStatus(start: Date, end: Date): Promise<OrderStatusCount[]> {
  const client = await createClient()
  const rows = await findOrderStatusesByDateRange(client, start, end)

  const statusMap = new Map<string, number>()
  for (const row of rows) {
    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1)
  }

  return Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => a.status.localeCompare(b.status))
}

/**
 * Groups POS sales by payment_status and returns counts sorted alphabetically.
 */
export async function getPOSSalesByStatus(start: Date, end: Date): Promise<OrderStatusCount[]> {
  const client = await createClient()
  const rows = await findPosSalesStatusesByDateRange(client, start, end)

  const statusMap = new Map<string, number>()
  for (const row of rows) {
    statusMap.set(row.payment_status, (statusMap.get(row.payment_status) ?? 0) + 1)
  }

  return Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => a.status.localeCompare(b.status))
}
