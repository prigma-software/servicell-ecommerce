"use client"

import * as React from "react"
import { useState } from "react"
import { AlertTriangle, Loader2, CheckCircle2, Circle } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"

interface CancelOrderModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<{ success: boolean; error?: string }>
  orderId: string
  isWompiPayment?: boolean
}

const PRESET_REASONS = [
  "No se pudo cobrar el dinero (Cliente no pagó)",
  "Solicitado por el cliente",
  "Devolución / Garantía de producto",
  "Datos de contacto falsos o inválidos",
  "Sin disponibilidad de inventario real",
  "Dirección de entrega fuera de cobertura",
]

export function CancelOrderModal({
  open,
  onClose,
  onConfirm,
  orderId,
  isWompiPayment = false,
}: CancelOrderModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>("")
  const [customReason, setCustomReason] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const finalReason = selectedPreset === "Otro" ? customReason : selectedPreset

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset)
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedReason = finalReason.trim()
    if (!trimmedReason) {
      setErrorMessage("Por favor selecciona o especifica el motivo de la cancelación.")
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const result = await onConfirm(trimmedReason)
      if (!result.success) {
        setErrorMessage(result.error || "Ocurrió un error al cancelar la orden.")
      } else {
        onClose()
        setSelectedPreset("")
        setCustomReason("")
      }
    } catch (err) {
      setErrorMessage((err as Error).message || "Error inesperado al cancelar.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-lg overflow-hidden border-border bg-card shadow-2xl">
      <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5">
        {/* Header with Icon Badge */}
        <div className="flex items-start gap-4 pb-1">
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive shrink-0 border border-destructive/20 shadow-xs">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Cancelar Compra #{orderId.slice(0, 8)}
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Esta acción devolverá las unidades al inventario y registrará la cancelación en el historial de auditoría.
            </p>
          </div>
        </div>

        {/* Wompi Warning Callout */}
        {isWompiPayment && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400 space-y-1.5 shadow-xs">
            <p className="font-semibold flex items-center gap-1.5 text-sm">
              <span>⚠️</span> Pago en línea (Wompi)
            </p>
            <p className="leading-relaxed">
              El inventario se repondrá automáticamente. Recuerda procesar el reembolso del dinero desde el portal oficial de Wompi.
            </p>
          </div>
        )}

        {/* Reason Presets Grid */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Selecciona el motivo de cancelación <span className="text-destructive">*</span>
          </label>
          
          <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {PRESET_REASONS.map((preset) => {
              const isSelected = selectedPreset === preset
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetChange(preset)}
                  className={`group relative flex items-center justify-between text-left text-xs px-3.5 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground font-semibold shadow-xs ring-1 ring-primary/30"
                      : "border-border/80 bg-background/50 hover:bg-muted/60 hover:border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="pr-4">{preset}</span>
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0" />
                  )}
                </button>
              )
            })}

            {/* Option "Otro" */}
            <button
              type="button"
              onClick={() => handlePresetChange("Otro")}
              className={`group relative flex items-center justify-between text-left text-xs px-3.5 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer ${
                selectedPreset === "Otro"
                  ? "border-primary bg-primary/10 text-foreground font-semibold shadow-xs ring-1 ring-primary/30"
                  : "border-border/80 bg-background/50 hover:bg-muted/60 hover:border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Otro motivo (personalizado)</span>
              {selectedPreset === "Otro" ? (
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* Custom Reason Textarea */}
        {selectedPreset === "Otro" && (
          <div className="space-y-1.5 animate-in fade-in-50 duration-150">
            <textarea
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value)
                setErrorMessage(null)
              }}
              placeholder="Explica detalladamente la razón de la cancelación..."
              className="w-full min-h-[85px] p-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-none shadow-xs"
              rows={3}
              required
            />
          </div>
        )}

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2 animate-in fade-in-50">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="px-4 cursor-pointer"
          >
            Volver
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={loading || (!selectedPreset && !customReason.trim())}
            className="px-5 shadow-sm font-semibold cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Cancelando...
              </>
            ) : (
              "Confirmar Cancelación"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
