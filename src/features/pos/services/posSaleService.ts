import { createAdminClient } from "@/lib/supabase/admin"
import {
  findPosSales,
  findPosSalesSummary,
  findTodayCashSales,
  findCashupEvents,
  insertPosSale,
  deletePosSaleById,
  insertPosSalePayments,
  insertPosCashEvent,
  decrementPosStock,
  type SaleItem,
  type SalePayment,
  type PosSaleFilters,
} from "@/features/pos/repositories/posRepository"

// ============================================
// Sales
// ============================================

export type CreateSaleBody = {
  customer_name?: string
  items: SaleItem[]
  discount_amount: number
  discount_reason?: string
  subtotal: number
  total: number
  payment_method: string
  amount_received?: number
  change_amount?: number
  payments?: SalePayment[]
  notes?: string
  channel?: string
  work_order_id?: string | null
}

/**
 * Creates a POS sale: inserts the sale record, split-payment entries (if any),
 * decrements stock, and registers a cash event for efectivo payments.
 * Rolls back the sale insert if stock decrement fails.
 */
export async function createSale(
  sellerId: string,
  body: CreateSaleBody
): Promise<{ success: boolean; sale: unknown }> {
  const client = await createAdminClient()

  const {
    customer_name,
    items,
    discount_amount,
    discount_reason,
    payment_method,
    amount_received,
    change_amount,
    payments,
    notes,
    channel,
    work_order_id,
  } = body

  // Recalcular precios reales desde catálogo en base de datos para impedir manipulación de precios
  const variantIds = items.filter((i) => i.variant_id).map((i) => i.variant_id!)
  const productIds = items.map((i) => i.product_id)

  const [skusRes, productsRes] = await Promise.all([
    variantIds.length > 0
      ? client.from("product_skus").select("id, product_id, price_override").in("id", variantIds)
      : { data: [], error: null },
    client.from("products").select("id, price").in("id", productIds),
  ])

  const skuMap = new Map((skusRes.data || []).map((s: any) => [s.id, s]))
  const productMap = new Map((productsRes.data || []).map((p: any) => [p.id, p]))

  let verifiedSubtotal = 0
  const verifiedItems: SaleItem[] = items.map((item) => {
    let officialUnitPrice: number
    if (item.variant_id) {
      const sku = skuMap.get(item.variant_id)
      const parent = sku ? productMap.get(sku.product_id) : undefined
      officialUnitPrice = sku?.price_override ?? parent?.price ?? 0
    } else {
      officialUnitPrice = productMap.get(item.product_id)?.price ?? 0
    }

    const discountPct = Math.max(0, Math.min(100, item.discount_pct || 0))
    const lineDiscount = Math.round(officialUnitPrice * (discountPct / 100))
    const effectiveUnitPrice = officialUnitPrice - lineDiscount
    const lineSubtotal = effectiveUnitPrice * item.quantity
    verifiedSubtotal += lineSubtotal

    return {
      ...item,
      unit_price: officialUnitPrice,
      discount_pct: discountPct,
      subtotal: lineSubtotal,
    }
  })

  const verifiedDiscountAmount = Math.max(0, discount_amount || 0)
  const verifiedTotal = Math.max(0, verifiedSubtotal - verifiedDiscountAmount)

  // Si hay pagos divididos, validar que la suma coincida con el total calculado
  if (payments && payments.length > 1) {
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
    if (Math.abs(totalPayments - verifiedTotal) > 1) {
      throw new Error(`Discrepancia en pagos: La suma de pagos (${totalPayments}) no coincide con el total calculado (${verifiedTotal})`)
    }
  }

  const sale = await insertPosSale(client, {
    seller_id: sellerId,
    customer_name: customer_name || null,
    items: JSON.stringify(verifiedItems),
    subtotal: verifiedSubtotal,
    discount_amount: verifiedDiscountAmount,
    discount_reason: discount_reason || null,
    total: verifiedTotal,
    payment_method,
    payment_status: "paid",
    amount_received: amount_received || null,
    change_amount: change_amount || null,
    notes: notes || null,
    channel: channel || "pos",
    work_order_id: work_order_id || null,
  })

  if (payments && payments.length > 1) {
    await insertPosSalePayments(client, sale.id, payments)
  }

  try {
    await decrementPosStock(client, verifiedItems)
  } catch (err) {
    console.error("Stock decrement failed, rolling back sale", err)
    await deletePosSaleById(client, sale.id)
    throw new Error("Stock insuficiente")
  }

  if (payment_method === "efectivo" && amount_received) {
    await insertPosCashEvent(client, {
      user_id: sellerId,
      type: "sale",
      amount: amount_received,
      payment_method: "efectivo",
    })
  }

  return { success: true, sale }
}

/**
 * Returns a filtered list of POS sales.
 */
export async function getSales(filters: PosSaleFilters) {
  const client = await createAdminClient()
  return findPosSales(client, filters)
}

/**
 * Returns a filtered list of POS sales (admin only).
 */
export async function getSalesAdmin(userId: string, filters: PosSaleFilters) {
  await requireAdminForReports(userId)
  const client = await createAdminClient()
  return findPosSales(client, filters)
}

// ============================================
// Cashup
// ============================================

/**
 * Calculates expected cash on hand from today's sales,
 * computes the difference against the declared amount,
 * and inserts a cashup event into the ledger.
 */
export async function createCashup(
  userId: string,
  declaredAmount: number,
  notes?: string
): Promise<{ declared_amount: number; expected_amount: number; difference: number }> {
  const client = await createAdminClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todaySales = await findTodayCashSales(client, today)
  const expectedCash = todaySales.reduce((sum, s) => {
    return sum + (s.amount_received || 0) - (s.change_amount || 0)
  }, 0)

  const difference = declaredAmount - expectedCash

  const cashupNote = `Declarado: $${declaredAmount.toLocaleString()}. Esperado: $${expectedCash.toLocaleString()}. Diferencia: $${difference.toLocaleString()}. ${notes || ""}`.trim()

  await insertPosCashEvent(client, {
    user_id: userId,
    type: "cashup",
    amount: declaredAmount,
    notes: cashupNote,
  })

  return {
    declared_amount: declaredAmount,
    expected_amount: expectedCash,
    difference,
  }
}

/**
 * Returns cashup events filtered by optional date range.
 */
export async function getCashups(from?: string | null, to?: string | null) {
  const client = await createAdminClient()
  return findCashupEvents(client, from, to)
}

/**
 * Asserts the user has admin role. Throws "Unauthorized" or "Forbidden".
 */
export async function requireAdminForReports(userId: string) {
  const client = await createAdminClient()

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single()

  if (profile?.role !== "administrador") throw new Error("Forbidden")
}

// ============================================
// Reports summary
// ============================================

type SaleRow = {
  total: number | string | null
  payment_method: string | null
  amount_received: number | string | null
  change_amount: number | string | null
}

/**
 * Aggregates POS sales into a summary report:
 * total count, total revenue, average ticket, breakdown by payment method,
 * and net cash in from efectivo sales.
 */
export async function getReportsSummary(userId: string, from?: string | null, to?: string | null) {
  await requireAdminForReports(userId)
  const client = await createAdminClient()
  const sales = await findPosSalesSummary(client, from, to)

  const totalSales = sales.length
  const totalAmount = sales.reduce((sum, s: SaleRow) => sum + Number(s.total), 0)
  const avgTicket = totalSales > 0 ? totalAmount / totalSales : 0

  const byPaymentMethod: Record<string, { count: number; amount: number }> = {
    efectivo: { count: 0, amount: 0 },
    tarjeta: { count: 0, amount: 0 },
    transferencia: { count: 0, amount: 0 },
    mixto: { count: 0, amount: 0 },
  }

  for (const sale of sales as SaleRow[]) {
    const method = sale.payment_method || "mixto"
    if (byPaymentMethod[method]) {
      byPaymentMethod[method].count++
      byPaymentMethod[method].amount += Number(sale.total)
    }
  }

  const efectivoCashIn = (sales as SaleRow[])
    .filter((s) => s.payment_method === "efectivo")
    .reduce((sum, s) => sum + Number(s.amount_received || 0) - Number(s.change_amount || 0), 0)

  return {
    total_sales: totalSales,
    total_amount: totalAmount,
    avg_ticket: avgTicket,
    by_payment_method: byPaymentMethod,
    efectivo_cash_in: efectivoCashIn,
  }
}
