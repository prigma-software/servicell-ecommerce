"use client"

import { X, Printer, Share2 } from "lucide-react"
import { useRef } from "react"

type SaleItem = {
  name: string
  sku: string | null
  quantity: number
  unit_price: number
  discount_pct: number
  subtotal: number
}

type ReceiptModalProps = {
  isOpen: boolean
  onClose: () => void
  sale: {
    id: string
    customer_name: string | null
    items: SaleItem[]
    subtotal: number
    discount_amount: number
    total: number
    payment_method: string
    amount_received: number | null
    change_amount: number | null
    created_at: string
    seller_email?: string
  }
  onNewSale: () => void
}

export default function ReceiptModal({ isOpen, onClose, sale, onNewSale }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handlePrint = () => {
    if (!receiptRef.current) return

    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      document.body.removeChild(iframe)
      return
    }

    const style = doc.createElement("style")
    style.textContent = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: monospace; font-size: 12px; padding: 10px; width: 80mm; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .right { text-align: right; }
      .line { border-top: 1px dashed #000; margin: 5px 0; }
      .row { display: flex; justify-content: space-between; margin: 2px 0; }
    `
    doc.head.appendChild(style)
    doc.body.appendChild(receiptRef.current.cloneNode(true))

    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe)
      }
    }, 1000)
  }

  const handleShare = async () => {
    const text = generateReceiptText()
    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        console.log("Share cancelled")
      }
    } else {
      await navigator.clipboard.writeText(text)
      alert("Recibo copiado al portapapeles")
    }
  }

  const generateReceiptText = () => {
    let text = ""
    text += "=== RECIBO DE VENTA ===\n"
    text += `${formatDate(sale.created_at)}\n`
    text += "----------------------------\n"

    sale.items.forEach((item) => {
      text += `${item.quantity}x ${item.name}\n`
      text += `  ${formatPrice(item.unit_price)} = ${formatPrice(item.subtotal)}\n`
      if (item.discount_pct > 0) {
        text += `  (Descuento ${item.discount_pct}%)\n`
      }
    })

    text += "----------------------------\n"
    text += `Subtotal: ${formatPrice(sale.subtotal)}\n`
    if (sale.discount_amount > 0) {
      text += `Descuento: -${formatPrice(sale.discount_amount)}\n`
    }
    text += `TOTAL: ${formatPrice(sale.total)}\n`
    text += "----------------------------\n"
    text += `Pago: ${sale.payment_method.toUpperCase()}\n`
    if (sale.payment_method === "efectivo" && sale.amount_received) {
      text += `Recibido: ${formatPrice(sale.amount_received)}\n`
      text += `Vuelto: ${formatPrice(sale.change_amount || 0)}\n`
    }
    text += "============================\n"
    text += "Gracias por su compra!\n"

    return text
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md border" onClick={(e) => e.stopPropagation()}>
        <div className="border-b p-6 flex justify-between items-center">
          <h2 className="text-xl font-extrabold text-card-foreground">Venta Completada</h2>
          <button onClick={onClose} className="p-1 bg-secondary rounded-full hover:bg-accent transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-success-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-3xl font-extrabold text-success">{formatPrice(sale.total)}</p>
            <p className="text-muted-foreground mt-1">Venta procesada exitosamente</p>
          </div>

          <div
            ref={receiptRef}
            className="bg-surface text-foreground p-4 rounded-lg font-mono text-sm max-h-64 overflow-auto"
          >
            <div className="text-center bold text-base mb-2">RECIBO DE VENTA</div>
            <div className="text-center text-xs mb-2">{formatDate(sale.created_at)}</div>
            <div className="line" />

            {sale.items.map((item, idx) => (
              <div key={idx} className="my-2">
                <div className="bold">{item.quantity}x {item.name}</div>
                <div className="flex justify-between">
                  <span>
                    {formatPrice(item.unit_price)} × {item.quantity}
                  </span>
                  <span>{formatPrice(item.subtotal)}</span>
                </div>
                {item.discount_pct > 0 && (
                  <div className="text-success text-xs">
                    Descuento {item.discount_pct}% aplicado
                  </div>
                )}
              </div>
            ))}

            <div className="line" />
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPrice(sale.subtotal)}</span>
            </div>
            {sale.discount_amount > 0 && (
              <div className="flex justify-between text-success">
                <span>Descuento</span>
                <span>-{formatPrice(sale.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between bold text-base mt-1">
              <span>TOTAL</span>
              <span>{formatPrice(sale.total)}</span>
            </div>

            <div className="line" />
            <div className="flex justify-between">
              <span>Pago</span>
              <span>{sale.payment_method.toUpperCase()}</span>
            </div>
            {sale.payment_method === "efectivo" && sale.amount_received && (
              <>
                <div className="flex justify-between">
                  <span>Recibido</span>
                  <span>{formatPrice(sale.amount_received)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vuelto</span>
                  <span>{formatPrice(sale.change_amount || 0)}</span>
                </div>
              </>
            )}
            <div className="line" />
            <div className="text-center text-xs">¡Gracias por su compra!</div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 py-3 border border-input rounded-lg font-semibold text-sm hover:bg-accent transition flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={handleShare}
              className="flex-1 py-3 border border-input rounded-lg font-semibold text-sm hover:bg-accent transition flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Compartir
            </button>
          </div>

          <button
            onClick={onNewSale}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-3 rounded-lg font-bold text-sm transition shadow-sm"
          >
            Nueva Venta
          </button>
        </div>
      </div>
    </div>
  )
}
