"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Package, User, MapPin, CreditCard, AlertTriangle, RotateCcw, Ban, Truck, DollarSign, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/modal"
import { formatPrice } from "@/lib/format"
import { STATUS_BADGE_STYLES, STATUS_BADGE_DEFAULT } from "@/lib/constants/orders"
import {
  rollbackOrderStock,
  markOrderAsError,
  approveManualOrder,
  markOrderAsPaid,
  cancelOrder,
} from "@/features/orders/actions/orderActions"
import { canTransitionOrder } from "@/features/orders/services/orderStatusTransitions"
import { CancelOrderModal } from "@/features/admin/components/CancelOrderModal"
import PaymentModal from "@/features/pos/components/PaymentModal"
import type { OrderWithRelations } from "@/features/orders/types/order.types"

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface OrderDetailsCardProps {
  order: OrderWithRelations
}

export function OrderDetailsCard({ order }: OrderDetailsCardProps) {
  const router = useRouter()
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [payConfirmOpen, setPayConfirmOpen] = useState(false)
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false)
  const [errorConfirmOpen, setErrorConfirmOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const isWompi = order.payment_method === "wompi" || !!order.wompi_transaction_id
  const canCancel = canTransitionOrder(order.status, "DECLINED")

  // Badge label and style resolution
  let badgeLabel: string = order.status
  let badgeClass: string = STATUS_BADGE_STYLES[order.status] ?? STATUS_BADGE_DEFAULT

  if (order.status === "APPROVED") {
    if (isWompi) {
      badgeLabel = "Aprobada (Pagada en línea)"
      badgeClass = "bg-success-muted text-success border-success"
    } else if (order.is_paid) {
      badgeLabel = "Aprobada y Pagada"
      badgeClass = "bg-success-muted text-success border-success"
    } else {
      badgeLabel = "Aprobada (Pendiente de Cobro)"
      badgeClass = "bg-warning-muted text-warning border-warning"
    }
  } else if (order.status === "PENDING_MANUAL") {
    badgeLabel = "Contra Entrega (Por Despachar)"
    badgeClass = "bg-warning-muted text-warning border-warning"
  } else if (order.status === "PENDING") {
    badgeLabel = "Pendiente (En línea)"
    badgeClass = "bg-warning-muted text-warning border-warning"
  } else if (order.status === "DECLINED") {
    badgeLabel = "Cancelada"
    badgeClass = "bg-danger-muted text-danger border-danger"
  }

  async function handleApproveManual() {
    setActionLoading(true)
    try {
      await approveManualOrder(order.id)
      setApproveConfirmOpen(false)
      router.refresh()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkPaid(
    method: string,
    amountReceived?: number,
    changeAmount?: number,
    payments?: { method: string; amount: number }[]
  ) {
    setActionLoading(true)
    try {
      await markOrderAsPaid(order.id, {
        method,
        amountReceived,
        changeAmount,
        payments,
      })
      setPayConfirmOpen(false)
      router.refresh()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancelOrder(reason: string) {
    const result = await cancelOrder(order.id, reason)
    if (result.success) {
      router.refresh()
    }
    return result
  }

  async function handleRollback() {
    setActionLoading(true)
    try {
      await rollbackOrderStock(order.id)
      setRollbackConfirmOpen(false)
      router.refresh()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkAsError() {
    setActionLoading(true)
    try {
      await markOrderAsError(order.id)
      setErrorConfirmOpen(false)
      router.refresh()
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card rounded-xl border border-border p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Orden #{order.id.slice(0, 8)}
            </h1>
            <button
              onClick={() => navigator.clipboard.writeText(order.id)}
              className="text-xs px-2.5 py-1 rounded-md border border-border/80 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Copiar ID completo"
            >
              Copiar ID
            </button>
          </div>
          <p className="text-muted-foreground text-xs mt-1.5">
            Registrada el {formatDate(order.created_at)}
          </p>
        </div>
        <div>
          <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full border shadow-xs ${badgeClass}`}>
            <span className="w-2 h-2 rounded-full bg-current opacity-75" />
            {badgeLabel}
          </span>
        </div>
      </div>

      {/* Cancellation Banner */}
      {order.status === "DECLINED" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 space-y-2.5 text-sm text-foreground shadow-xs animate-in fade-in-50">
          <div className="flex items-center gap-2.5 font-semibold text-destructive text-base">
            <Ban className="w-5 h-5" />
            <span>Esta orden fue cancelada</span>
          </div>
          {order.cancellation_reason && (
            <p className="text-xs text-foreground/90 pl-7">
              <strong className="text-muted-foreground">Motivo:</strong> {order.cancellation_reason}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pl-7 pt-1">
            {order.cancelled_at && (
              <span>Fecha: {formatDate(order.cancelled_at)}</span>
            )}
            <span>
              Inventario: {order.stock_returned ? "✅ Unidades reincorporadas" : "Pendiente de devolución"}
            </span>
          </div>
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Info Card */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-xs space-y-4">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-3">
            <User className="w-4 h-4 text-primary" />
            Información del Cliente
          </h2>
          <div className="space-y-2.5 text-sm">
            <p className="font-semibold text-foreground text-base">{order.customer_name || "Sin nombre"}</p>
            <p className="text-xs text-muted-foreground">
              Email:{" "}
              {(order.customer_email || order.profiles?.email) ? (
                <a href={`mailto:${order.customer_email || order.profiles?.email}`} className="text-primary hover:underline font-medium">
                  {order.customer_email || order.profiles?.email}
                </a>
              ) : <span className="text-muted-foreground">No registrado</span>}
            </p>
            {order.customer_phone && (
              <p className="text-xs text-muted-foreground">
                Teléfono:{" "}
                <a href={`tel:${order.customer_phone}`} className="text-primary hover:underline font-medium">
                  {order.customer_phone}
                </a>
              </p>
            )}
            {order.payment_method && (
              <div className="pt-2 border-t border-border/50 text-xs">
                <p className="text-muted-foreground">
                  Método de pago: <span className="font-semibold text-foreground">{order.payment_method === 'wompi' ? 'En línea (Wompi)' : 'Contra entrega'}</span>
                </p>
              </div>
            )}
            {order.payment_method === 'manual' && order.status === 'APPROVED' && (
              <p className="text-xs font-semibold">
                Estado del cobro: {order.is_paid ? '🟢 Dinero Recaudado' : '🟡 Pendiente de Recaudar'}
              </p>
            )}
            {order.wompi_transaction_id && (
              <p className="text-xs font-mono text-muted-foreground pt-1">
                Wompi ID: {order.wompi_transaction_id}
              </p>
            )}
          </div>
        </div>

        {/* Shipping Address Card */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-xs space-y-4">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-3">
            <MapPin className="w-4 h-4 text-primary" />
            Destino y Dirección de Entrega
          </h2>
          <div className="space-y-2 text-sm">
            {order.shipping_zones?.name && (
              <p className="text-xs text-muted-foreground">
                Ciudad / Zona: <span className="font-semibold text-foreground">{order.shipping_zones.name}</span>
              </p>
            )}
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-background/60 p-3.5 rounded-lg border border-border/60 text-xs">
              {order.shipping_address || "No proporcionada"}
            </p>
          </div>
        </div>
      </div>

      {/* Order Items Table Card */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-border bg-muted/30">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Productos de la Orden
          </h2>
        </div>
        <div className="divide-y divide-border">
          {order.order_items?.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 sm:p-5 gap-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-muted rounded-lg flex items-center justify-center overflow-hidden border border-border">
                  {item.products?.image_url ? (
                    <Image
                      src={item.products.image_url}
                      alt={item.products.name || "Producto"}
                      width={56}
                      height={56}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground text-sm">
                    {item.products?.name || "Producto desconocido"}
                  </p>
                  {item.product_skus?.sku_code && (
                    <p className="text-xs font-mono text-muted-foreground">
                      SKU: {item.product_skus.sku_code}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × {formatPrice(item.price_at_purchase)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="font-bold text-foreground text-base">
                  {formatPrice(item.price_at_purchase * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Total Footer */}
        <div className="p-5 border-t border-border bg-muted/20 flex justify-between items-center">
          <span className="font-semibold text-foreground text-sm">Total de la Orden</span>
          <span className="text-2xl font-black tracking-tight text-primary">
            {formatPrice(order.total_amount)}
          </span>
        </div>
      </div>

      {/* Actions Panel */}
      <div className="bg-card rounded-xl border border-border p-6 sm:p-7 shadow-xs space-y-4">
        <div className="border-b border-border/60 pb-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
            <CreditCard className="w-4 h-4 text-primary" />
            Acciones y Control Operativo
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Gestiona las transiciones de estado, confirmación de cobro físico y cancelaciones con devolución de inventario.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* 1. Paso Inicial: Aprobar orden contra entrega para despacho */}
          {order.status === "PENDING_MANUAL" && (
            <Button
              onClick={() => setApproveConfirmOpen(true)}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 cursor-pointer font-semibold shadow-xs"
            >
              <Truck className="w-4 h-4 mr-2" />
              Aprobar para Despacho
            </Button>
          )}

          {/* 2. Paso Secundario: Confirmar pago recaudado en entrega */}
          {order.status === "APPROVED" && order.payment_method === "manual" && !order.is_paid && (
            <Button
              onClick={() => setPayConfirmOpen(true)}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 cursor-pointer font-semibold shadow-xs"
            >
              <DollarSign className="w-4 h-4 mr-1.5" />
              Confirmar Pago Recibido
            </Button>
          )}

          {/* 3. Botón de Cancelación Universal (Válido para PENDING, PENDING_MANUAL y APPROVED) */}
          {canCancel && (
            <Button
              variant="destructive"
              onClick={() => setCancelModalOpen(true)}
              disabled={actionLoading}
              className="px-5 cursor-pointer font-semibold shadow-xs"
            >
              <Ban className="w-4 h-4 mr-2" />
              Cancelar Compra
            </Button>
          )}

          {/* Fallback de error solo para órdenes PENDING online */}
          {order.status === "PENDING" && (
            <Button
              variant="outline"
              onClick={() => setErrorConfirmOpen(true)}
              disabled={actionLoading}
              className="px-4 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              Marcar como Error
            </Button>
          )}

          {/* Rollback de stock forzado solo si no se ha retornado */}
          {!order.stock_returned && order.status !== "PENDING" && order.status !== "DECLINED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRollbackConfirmOpen(true)}
              disabled={actionLoading}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Forzar Restauración de Stock
            </Button>
          )}
        </div>
      </div>

      {/* Modales de Confirmación y Cancelación */}
      <CancelOrderModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancelOrder}
        orderId={order.id}
        isWompiPayment={isWompi}
      />

      <ConfirmDialog
        open={approveConfirmOpen}
        onClose={() => setApproveConfirmOpen(false)}
        onConfirm={handleApproveManual}
        title="¿Aprobar pedido para despacho?"
        description="La orden pasará a estado APROBADA para que pueda ser empacada y despachada al cliente. El estado quedará como 'Pendiente de Cobro' hasta que el mensajero confirme el pago."
        confirmText="Aprobar para Despacho"
        cancelText="Volver"
      />

      <PaymentModal
        isOpen={payConfirmOpen}
        onClose={() => setPayConfirmOpen(false)}
        total={order.total_amount}
        onConfirm={handleMarkPaid}
      />

      <ConfirmDialog
        open={rollbackConfirmOpen}
        onClose={() => setRollbackConfirmOpen(false)}
        onConfirm={handleRollback}
        title="¿Restaurar stock?"
        description="Esta acción devolverá las unidades de esta orden al inventario sin cambiar el estado actual."
        confirmText="Restaurar Stock"
        cancelText="Cancelar"
      />

      <ConfirmDialog
        open={errorConfirmOpen}
        onClose={() => setErrorConfirmOpen(false)}
        onConfirm={handleMarkAsError}
        title="¿Marcar como error?"
        description="La orden pasará a estado ERROR y se restaurará el stock automáticamente."
        confirmText="Marcar Error"
        cancelText="Cancelar"
        destructive
      />
    </div>
  )
}