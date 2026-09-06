import { NextRequest, NextResponse } from "next/server"
import { runCleanup } from "@/features/cart/services/cleanupService"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAuditLog } from "@/features/admin/services/auditService"
import {
  findPendingManualOrdersOlderThan,
  findOrderItems,
} from "@/features/orders/repositories/orderRepository"
import {
  incrementSkuStock,
  incrementProductStock,
} from "@/features/cart/repositories/stockRepository"
import { verificarLicencia } from "@/shared/actions/licenseActions"

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  // Protect endpoint: require CRON_SECRET in production or if CRON_SECRET is configured
  if (process.env.NODE_ENV === "production" || cronSecret) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const adminClient = await createAdminClient()
    const results = {
      cleanup: await runCleanup(),
      manual_orders_processed: 0,
      manual_orders_errors: 0,
      license_checked: false,
    }

    // 1. Limpieza de carritos y órdenes Wompi huérfanas (vía runCleanup)
    
    // 2. Limpieza de Órdenes Manuales > 72 horas
    const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    const pendingManualOrders = await findPendingManualOrdersOlderThan(adminClient, cutoff72h)
    
    if (pendingManualOrders && pendingManualOrders.length > 0) {
      console.log(`[CRON] Found ${pendingManualOrders.length} PENDING_MANUAL orders to expire`)
      
      for (const order of pendingManualOrders) {
        try {
          const items = await findOrderItems(adminClient, order.id)

          // 1. Restaurar stock en paralelo
          if (items && items.length > 0) {
            await Promise.all(
              items.map((item) => {
                if (item.variant_id) {
                  return incrementSkuStock(adminClient, item.variant_id, item.quantity)
                } else {
                  return incrementProductStock(adminClient, item.product_id, item.quantity)
                }
              })
            )
          }

          // 2. Actualizar estado a DECLINED con metadatos completos y stock_returned = true
          await adminClient
            .from("orders")
            .update({
              status: "DECLINED",
              stock_returned: true,
              cancellation_reason: "Expiración automática por inactividad > 72 horas (Cron)",
              cancelled_at: new Date().toISOString(),
            })
            .eq("id", order.id)

          // 3. Registrar Log de Auditoría
          await createAuditLog(adminClient, {
            action: "ORDER_EXPIRED_CRON",
            target_type: "order",
            target_id: order.id,
            reason: "Expiración automática por inactividad > 72 horas (Cron)",
          }).catch((err) => console.warn("[CRON] Audit log warning:", err))

          console.log(`[CRON] Manual order ${order.id} marked as DECLINED, stock restored`)
          results.manual_orders_processed++
        } catch (err) {
          console.error(`[CRON] Error processing manual order ${order.id}:`, err)
          results.manual_orders_errors++
        }
      }
    }

    // 3. Validación de Licencia PRIGMA
    try {
      await verificarLicencia()
      results.license_checked = true
    } catch (err) {
      console.error("[CRON] Error checking license:", err)
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `Maintenance completed successfully`,
    })
  } catch (error) {
    console.error("Maintenance error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST only. Executes unified cron maintenance (cleanup, manual orders expiry, license validation).",
  })
}
