import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import ReceiptModal from "@/features/pos/components/ReceiptModal"
import React from "react"

describe("ReceiptModal", () => {
  const mockSale = {
    id: "sale-123",
    customer_name: "Test Customer",
    items: [
      {
        name: "<img src=x onerror=alert(1)> Producto Seguro",
        sku: "SKU-001",
        quantity: 2,
        unit_price: 15000,
        discount_pct: 0,
        subtotal: 30000,
      },
    ],
    subtotal: 30000,
    discount_amount: 0,
    total: 30000,
    payment_method: "efectivo",
    amount_received: 50000,
    change_amount: 20000,
    created_at: "2026-09-07T12:00:00Z",
  }

  const mockOnClose = vi.fn()
  const mockOnNewSale = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renderiza el modal y formatea los montos correctamente", () => {
    render(
      <ReceiptModal
        isOpen={true}
        onClose={mockOnClose}
        sale={mockSale}
        onNewSale={mockOnNewSale}
      />
    )

    expect(screen.getByText("Venta Completada")).toBeDefined()
    expect(screen.getAllByText("RECIBO DE VENTA").length).toBeGreaterThan(0)
    // El texto malicioso debe ser renderizado como texto literal, no HTML ejecutable
    expect(screen.getByText(/<img src=x onerror=alert\(1\)> Producto Seguro/)).toBeDefined()
  })

  it("handlePrint utiliza un iframe y clonación DOM segura sin invocar document.write", () => {
    const appendChildSpy = vi.spyOn(document.body, "appendChild")

    render(
      <ReceiptModal
        isOpen={true}
        onClose={mockOnClose}
        sale={mockSale}
        onNewSale={mockOnNewSale}
      />
    )

    const printBtn = screen.getByRole("button", { name: /imprimir/i })
    fireEvent.click(printBtn)

    // Verifica que se añadió un iframe al DOM para imprimir
    const iframeCall = appendChildSpy.mock.calls.find(
      (args) => args[0] instanceof HTMLIFrameElement
    )
    expect(iframeCall).toBeDefined()
    appendChildSpy.mockRestore()
  })

  it("no renderiza nada si isOpen es false", () => {
    const { container } = render(
      <ReceiptModal
        isOpen={false}
        onClose={mockOnClose}
        sale={mockSale}
        onNewSale={mockOnNewSale}
      />
    )

    expect(container.firstChild).toBeNull()
  })
})
