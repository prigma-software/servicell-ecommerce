"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/format"

type CartSummaryProps = {
  total: number
  hasBlockedItems: boolean
}

export default function CartSummary({ total, hasBlockedItems }: CartSummaryProps) {
  return (
    <div className="w-full lg:w-1/3 bg-card rounded-xl shadow-sm border p-6 sticky top-24">
      <h2 className="text-xl font-extrabold text-card-foreground mb-6">Resumen</h2>

      <div className="flex justify-between items-center mb-3 text-muted-foreground font-medium">
        <span>Subtotal</span>
        <span>{formatPrice(total)}</span>
      </div>

      <div className="flex justify-between items-center mb-4 text-muted-foreground font-medium text-sm">
        <span>Envío</span>
        <span className="text-xs text-muted-foreground font-normal">Calculado en el checkout</span>
      </div>

      <hr className="my-4 border-border" />

      <div className="flex justify-between items-center mb-8">
        <span className="text-lg font-extrabold text-card-foreground">Total</span>
        <span className="text-lg font-extrabold text-primary">
          {formatPrice(total)}
        </span>
      </div>

      {hasBlockedItems ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive font-medium">
            No puedes proceder al pago mientras haya productos no disponibles.
          </p>
          <Button disabled className="w-full">
            Proceder al Pago
          </Button>
          <Link
            href="/"
            className="block w-full text-center bg-secondary text-secondary-foreground py-3 rounded-lg font-semibold hover:bg-secondary/90 transition shadow-sm"
          >
            Volver a la tienda
          </Link>
        </div>
      ) : (
        <Link
          href="/checkout"
          className="block w-full text-center bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition shadow-sm"
        >
          Proceder al Pago
        </Link>
      )}
    </div>
  )
}
