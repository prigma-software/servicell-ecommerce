import { NextRequest, NextResponse } from "next/server"
import { exportOrdersToCSV } from "@/features/orders/services/orderService"
import { assertAdmin } from "@/shared/utils/authGuards"
import { createClient } from "@/lib/supabase/server"
import { createAuditLog } from "@/features/admin/services/auditService"
import type { OrderStatus } from "@/features/orders/types/order.types"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const admin = await assertAdmin()

    const { searchParams } = new URL(request.url)

    const rawStatus = searchParams.get("status")
    const rawSearch = searchParams.get("search")

    const validStatuses: OrderStatus[] = ["PENDING", "APPROVED", "DECLINED", "ERROR"]
    const status: OrderStatus | "ALL" =
      rawStatus && validStatuses.includes(rawStatus as OrderStatus)
        ? (rawStatus as OrderStatus)
        : "ALL"

    const search = rawSearch ? rawSearch.slice(0, 200).trim() : ""

    const csv = await exportOrdersToCSV({ status, search })

    // Registrar en Audit Log para trazabilidad de datos personales (Habeas Data)
    const supabase = await createClient()
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown"
    createAuditLog(supabase, {
      user_id: admin.id,
      user_email: admin.email,
      action: "ORDERS_EXPORT_CSV",
      target_type: "orders_export",
      target_id: "export_" + new Date().toISOString(),
      reason: "Descarga masiva de órdenes en CSV",
      metadata: { status, search, ip },
    }).catch((err) => console.error("Error creating export audit log:", err))

    if (!csv) {
      return new NextResponse("", { status: 204 })
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    const message = (error as Error).message
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Export error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}