import { describe, it, expect, vi, beforeEach } from "vitest"
import { canTransitionOrder } from "./orderStatusTransitions"
import { createOrder } from "./orderService"
import type { OrderItem } from "../types/order.types"

// Mock Supabase Server Client
let mockUser: { id: string; email: string } | null = { id: "user-123", email: "user@example.com" }
let mockReservationData: any = null
let mockReservationError: any = null

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: mockUser } })),
  },
  from: vi.fn((table: string) => {
    if (table === "stock_reservations") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn(async () => ({
              data: mockReservationData,
              error: mockReservationError,
            })),
          }),
        }),
      }
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: null, error: null })),
    }
  }),
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}))

// Mock Repositories
vi.mock("@/features/cart/repositories/stockRepository", () => ({
  findSkusByIds: vi.fn(),
  findProductsByIds: vi.fn(),
  incrementSkuStock: vi.fn(),
  incrementProductStock: vi.fn(),
}))

vi.mock("@/features/orders/repositories/orderRepository", () => ({
  insertOrder: vi.fn(async () => ({ id: "order-999" })),
  insertOrderItems: vi.fn(async () => undefined),
  findOrderItems: vi.fn(async () => []),
  findPendingOrdersOlderThan: vi.fn(async () => []),
  findPendingManualOrdersOlderThan: vi.fn(async () => []),
}))

import {
  findSkusByIds,
  findProductsByIds,
} from "@/features/cart/repositories/stockRepository"
import {
  insertOrder,
  insertOrderItems,
} from "@/features/orders/repositories/orderRepository"

describe("Order Cancellation & State Transitions", () => {
  it("allows transitioning from APPROVED to DECLINED (cancellation)", () => {
    expect(canTransitionOrder("APPROVED", "DECLINED")).toBe(true)
  })

  it("allows transitioning from PENDING_MANUAL to DECLINED (cancellation)", () => {
    expect(canTransitionOrder("PENDING_MANUAL", "DECLINED")).toBe(true)
  })

  it("allows transitioning from PENDING to DECLINED (cancellation)", () => {
    expect(canTransitionOrder("PENDING", "DECLINED")).toBe(true)
  })

  it("blocks cancelling an already DECLINED order", () => {
    expect(canTransitionOrder("DECLINED", "DECLINED")).toBe(true) // identity
    expect(canTransitionOrder("DECLINED", "APPROVED")).toBe(false)
  })

  it("blocks cancelling an ERROR order", () => {
    expect(canTransitionOrder("ERROR", "DECLINED")).toBe(false)
  })
})

describe("createOrder - Stock Validation & Wompi Reservation", () => {
  const sampleItems: OrderItem[] = [
    {
      id: "item-1",
      product_id: "prod-1",
      quantity: 1,
      name: "Camisa",
      price: 50000,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { id: "user-123", email: "user@example.com" }
    mockReservationError = null
    mockReservationData = null

    vi.mocked(findSkusByIds).mockResolvedValue([])
    vi.mocked(findProductsByIds).mockResolvedValue([
      {
        id: "prod-1",
        price: 50000,
        stock: 0, // Stock is 0 in DB because create_stock_reservation already deducted it!
        active: true,
        archived: false,
        name: "Camisa",
      } as any,
    ])
  })

  it("successfully creates a Wompi order when stock is 0 in DB but covered by valid reservation", async () => {
    mockReservationData = {
      id: "res-abc",
      user_id: "user-123",
      status: "pending",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      stock_reservation_items: [
        {
          product_id: "prod-1",
          variant_id: null,
          quantity: 1,
        },
      ],
    }

    const orderId = await createOrder(
      sampleItems,
      50000,
      "Juan Perez",
      "3001234567",
      "Calle 123",
      0,
      undefined,
      "wompi",
      "res-abc"
    )

    expect(orderId).toBe("order-999")
    expect(insertOrder).toHaveBeenCalledTimes(1)
    expect(insertOrderItems).toHaveBeenCalledTimes(1)
  })

  it("rejects Wompi order when reservationId is missing", async () => {
    await expect(
      createOrder(
        sampleItems,
        50000,
        "Juan Perez",
        "3001234567",
        "Calle 123",
        0,
        undefined,
        "wompi",
        undefined
      )
    ).rejects.toThrow("Se requiere una reserva de stock activa")
  })

  it("rejects Wompi order when reservation belongs to a different user", async () => {
    mockReservationData = {
      id: "res-abc",
      user_id: "other-user-999",
      status: "pending",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      stock_reservation_items: [
        {
          product_id: "prod-1",
          variant_id: null,
          quantity: 1,
        },
      ],
    }

    await expect(
      createOrder(
        sampleItems,
        50000,
        "Juan Perez",
        "3001234567",
        "Calle 123",
        0,
        undefined,
        "wompi",
        "res-abc"
      )
    ).rejects.toThrow("La reserva de stock no pertenece a este usuario")
  })

  it("rejects Wompi order when reservation is expired", async () => {
    mockReservationData = {
      id: "res-abc",
      user_id: "user-123",
      status: "pending",
      expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Expired 5 min ago
      stock_reservation_items: [
        {
          product_id: "prod-1",
          variant_id: null,
          quantity: 1,
        },
      ],
    }

    await expect(
      createOrder(
        sampleItems,
        50000,
        "Juan Perez",
        "3001234567",
        "Calle 123",
        0,
        undefined,
        "wompi",
        "res-abc"
      )
    ).rejects.toThrow("La reserva de stock ha expirado")
  })

  it("rejects Wompi order when reservation does not cover requested quantity", async () => {
    mockReservationData = {
      id: "res-abc",
      user_id: "user-123",
      status: "pending",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      stock_reservation_items: [
        {
          product_id: "prod-1",
          variant_id: null,
          quantity: 1, // only 1 reserved
        },
      ],
    }

    const itemsRequestingTwo: OrderItem[] = [
      {
        id: "item-1",
        product_id: "prod-1",
        quantity: 2, // requesting 2!
        name: "Camisa",
        price: 50000,
      },
    ]

    await expect(
      createOrder(
        itemsRequestingTwo,
        100000,
        "Juan Perez",
        "3001234567",
        "Calle 123",
        0,
        undefined,
        "wompi",
        "res-abc"
      )
    ).rejects.toThrow("La reserva no cubre la cantidad solicitada")
  })

  it("rejects manual order when stock in DB is insufficient (0 < 1)", async () => {
    // Manual order does NOT use reservation, checks stock directly in DB
    await expect(
      createOrder(
        sampleItems,
        50000,
        "Juan Perez",
        "3001234567",
        "Calle 123",
        0,
        undefined,
        "manual",
        undefined
      )
    ).rejects.toThrow("Stock insuficiente para: Camisa")
  })
})
