"use client"

import Link from "next/link"
import { formatPrice } from "@/lib/format"
import { STATUS_BADGE_STYLES, STATUS_BADGE_DEFAULT, STATUS_LABELS } from "@/lib/constants/orders"
import type { OrderWithRelations } from "@/features/orders/types/order.types"

interface OrdersTableProps {
  orders: OrderWithRelations[]
  isLoading?: boolean
}

export function OrdersTable({ orders, isLoading }: OrdersTableProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="animate-pulse p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b border-border last:border-0" />
          ))}
        </div>
      </div>
    )
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-12 text-center">
          <p className="text-muted-foreground">No se encontraron órdenes</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ref ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Fecha / Hora
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Estado
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr
                key={order.id}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="block"
                  >
                    <div className="text-sm font-mono font-medium text-foreground hover:text-primary">
                      {order.id.slice(0, 8)}...
                    </div>
                    {order.wompi_transaction_id && (
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        Wompi: {order.wompi_transaction_id.slice(0, 8)}...
                      </div>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-foreground">
                    <span className="text-muted-foreground mr-1">Nombre:</span>
                    <Link href={`/admin/orders/${order.id}`} className="hover:text-primary">
                      {order.customer_name || "Sin nombre"}
                    </Link>
                  </div>
                  
                  {(order.customer_email || order.profiles?.email) && (
                    <div className="text-xs mt-1">
                      <span className="text-muted-foreground mr-1">Email:</span>
                      <a href={`mailto:${order.customer_email || order.profiles?.email}`} className="text-primary hover:text-primary/80 hover:underline">
                        {order.customer_email || order.profiles?.email}
                      </a>
                    </div>
                  )}

                  {order.customer_phone && (
                    <div className="text-xs mt-1">
                      <span className="text-muted-foreground mr-1">Tel:</span>
                      <a href={`tel:${order.customer_phone}`} className="text-primary hover:text-primary/80 hover:underline">
                        {order.customer_phone}
                      </a>
                    </div>
                  )}
                  
                  {order.shipping_zones?.name && (
                    <div className="text-xs mt-1">
                      <span className="text-muted-foreground mr-1">Ciudad:</span>
                      <span className="font-semibold text-foreground">
                        {order.shipping_zones.name}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-foreground">
                    {new Date(order.created_at).toLocaleDateString("es-CO")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const isWompi = order.payment_method === "wompi" || !!order.wompi_transaction_id
                    let label = STATUS_LABELS[order.status] ?? order.status
                    let style = STATUS_BADGE_STYLES[order.status] ?? STATUS_BADGE_DEFAULT

                    if (order.status === "APPROVED") {
                      if (isWompi) {
                        label = "Aprobada (Wompi)"
                        style = "bg-success-muted text-success border-success"
                      } else if (order.is_paid) {
                        label = "Aprobada y Cobrada"
                        style = "bg-success-muted text-success border-success"
                      } else {
                        label = "Despachada (Por Cobrar)"
                        style = "bg-warning-muted text-warning border-warning"
                      }
                    } else if (order.status === "PENDING_MANUAL") {
                      label = "Contra Entrega (Por Despachar)"
                      style = "bg-warning-muted text-warning border-warning"
                    }

                    return (
                      <span
                        className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${style}`}
                      >
                        {label}
                      </span>
                    )
                  })()}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-bold text-foreground">
                    {formatPrice(order.total_amount)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}