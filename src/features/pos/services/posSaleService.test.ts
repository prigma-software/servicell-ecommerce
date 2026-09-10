import { describe, it, expect, vi, beforeEach } from "vitest"
import { createSale } from "./posSaleService"

// Mock Supabase Admin Client
const mockAdminClient = {
  from: vi.fn((table: string) => {
    if (table === "product_skus") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: "sku-1", product_id: "prod-1", price_override: 25000 }],
            error: null,
          }),
        }),
      }
    }
    if (table === "products") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: "prod-1", price: 20000 }, { id: "prod-2", price: 50000 }],
            error: null,
          }),
        }),
      }
    }
    return {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
  }),
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(async () => mockAdminClient),
}))

// Mock POS Repository
const mockInsertedSale = { id: "sale-100", total: 0 }
const mockInsertPosSale = vi.fn(async (_client: any, saleData: any) => ({
  ...mockInsertedSale,
  ...saleData,
}))
const mockDeletePosSaleById = vi.fn(async (_client: any, _id: string) => undefined)
const mockInsertPosSalePayments = vi.fn(async (_client: any, _id: string, _p: any) => undefined)
const mockInsertPosCashEvent = vi.fn(async (_client: any, _event: any) => undefined)
const mockDecrementPosStock = vi.fn(async (_client: any, _items: any) => undefined)

vi.mock("@/features/pos/repositories/posRepository", () => ({
  insertPosSale: (client: any, data: any) => mockInsertPosSale(client, data),
  deletePosSaleById: (client: any, id: string) => mockDeletePosSaleById(client, id),
  insertPosSalePayments: (client: any, id: string, p: any) => mockInsertPosSalePayments(client, id, p),
  insertPosCashEvent: (client: any, event: any) => mockInsertPosCashEvent(client, event),
  decrementPosStock: (client: any, items: any) => mockDecrementPosStock(client, items),
  findPosSales: vi.fn(),
  findPosSalesSummary: vi.fn(),
  findTodayCashSales: vi.fn(),
  findCashupEvents: vi.fn(),
}))

describe("posSaleService - createSale Security & Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("recalcula precios de productos desde la base de datos e ignora manipulación a $0 desde el cliente", async () => {
    const maliciousPayload = {
      items: [
        {
          name: "Producto 2",
          sku: null,
          product_id: "prod-2",
          variant_id: undefined,
          quantity: 2,
          unit_price: 0, // Intento de hack: enviar precio $0
          discount_pct: 0,
          subtotal: 0,
        },
      ],
      discount_amount: 0,
      subtotal: 0,
      total: 0, // Intento de hack: pagar $0
      payment_method: "efectivo",
      amount_received: 100000,
    }

    const result = await createSale("admin-seller-id", maliciousPayload)

    expect(result.success).toBe(true)
    expect(mockInsertPosSale).toHaveBeenCalledTimes(1)

    const savedData = mockInsertPosSale.mock.calls[0][1]
    // El precio real en BD de prod-2 es 50,000 COP, por 2 unidades = 100,000 COP
    expect(savedData.subtotal).toBe(100000)
    expect(savedData.total).toBe(100000)

    const parsedItems = JSON.parse(savedData.items)
    expect(parsedItems[0].unit_price).toBe(50000)
    expect(parsedItems[0].subtotal).toBe(100000)
  })

  it("utiliza price_override de variante cuando existe", async () => {
    const payload = {
      items: [
        {
          name: "Producto 1 Variante",
          sku: "SKU-1",
          product_id: "prod-1",
          variant_id: "sku-1",
          quantity: 1,
          unit_price: 100, // manipulado
          discount_pct: 0,
          subtotal: 100,
        },
      ],
      discount_amount: 0,
      subtotal: 100,
      total: 100,
      payment_method: "tarjeta",
    }

    const result = await createSale("admin-seller-id", payload)

    expect(result.success).toBe(true)
    const savedData = mockInsertPosSale.mock.calls[0][1]
    // Sku-1 tiene price_override de 25,000
    expect(savedData.total).toBe(25000)
  })

  it("rechaza la venta si la suma de pagos divididos no coincide con el total recalculado", async () => {
    const payload = {
      items: [
        {
          name: "Producto 2",
          sku: null,
          product_id: "prod-2", // cuesta 50,000
          variant_id: undefined,
          quantity: 1,
          unit_price: 50000,
          discount_pct: 0,
          subtotal: 50000,
        },
      ],
      discount_amount: 0,
      subtotal: 50000,
      total: 50000,
      payment_method: "dividido",
      payments: [
        { method: "efectivo", amount: 10000 },
        { method: "tarjeta", amount: 20000 }, // Suma 30,000 pero total es 50,000
      ],
    }

    await expect(createSale("admin-seller-id", payload)).rejects.toThrow(
      /Discrepancia en pagos/
    )

    expect(mockInsertPosSale).not.toHaveBeenCalled()
  })

  it("revierte la venta insertada si el decremento de stock falla", async () => {
    mockDecrementPosStock.mockRejectedValueOnce(new Error("Sin inventario"))

    const payload = {
      items: [
        {
          name: "Producto 2",
          sku: null,
          product_id: "prod-2",
          variant_id: undefined,
          quantity: 10,
          unit_price: 50000,
          discount_pct: 0,
          subtotal: 500000,
        },
      ],
      discount_amount: 0,
      subtotal: 500000,
      total: 500000,
      payment_method: "efectivo",
    }

    await expect(createSale("admin-seller-id", payload)).rejects.toThrow(
      "Stock insuficiente"
    )

    expect(mockInsertPosSale).toHaveBeenCalledTimes(1)
    expect(mockDeletePosSaleById).toHaveBeenCalledWith(mockAdminClient, "sale-100")
  })
})
