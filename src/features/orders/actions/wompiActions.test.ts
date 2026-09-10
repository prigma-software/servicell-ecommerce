import { describe, it, expect, vi, beforeEach } from "vitest"
import crypto from "crypto"
import { getWompiIntegritySignature } from "./wompiActions"

const mockGetUser = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          single: mockSingle,
        }),
      }),
    })),
  })),
}))

describe("getWompiIntegritySignature", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, WOMPI_INTEGRITY_SECRET: "test_secret_xyz" }
  })

  it("rechaza peticiones de usuarios no autenticados", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("No session") })

    await expect(getWompiIntegritySignature("order-123", 50000)).rejects.toThrow("No autenticado")
  })

  it("rechaza si la orden no existe en la base de datos", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    mockSingle.mockResolvedValue({ data: null, error: { message: "Not found" } })

    await expect(getWompiIntegritySignature("order-999", 50000)).rejects.toThrow("Orden no encontrada")
  })

  it("rechaza si la orden pertenece a otro usuario", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "attacker-id" } }, error: null })
    mockSingle.mockResolvedValue({
      data: { id: "order-123", total_amount: 50000, user_id: "legit-user-id", status: "PENDING" },
      error: null,
    })

    await expect(getWompiIntegritySignature("order-123", 50000)).rejects.toThrow("Acceso denegado a la orden")
  })

  it("rechaza si la orden no está en estado PENDING", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    mockSingle.mockResolvedValue({
      data: { id: "order-123", total_amount: 50000, user_id: "user-1", status: "APPROVED" },
      error: null,
    })

    await expect(getWompiIntegritySignature("order-123", 50000)).rejects.toThrow(
      "Solo las órdenes pendientes pueden recibir firma de pago"
    )
  })

  it("calcula la firma usando el total_amount real de la BD ignorando montos alterados del cliente", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    mockSingle.mockResolvedValue({
      data: { id: "order-123", total_amount: 150000, user_id: "user-1", status: "PENDING" },
      error: null,
    })

    // Atacante intenta pedir firma por 1000 centavos ($10 COP) para una orden de $150.000 COP
    const signature = await getWompiIntegritySignature("order-123", 1000, "COP")

    // La firma generada debe ser sobre el monto real en centavos de la BD: 150000 * 100 = 15000000
    const expectedHash = crypto
      .createHash("sha256")
      .update("order-123" + "15000000" + "COP" + "test_secret_xyz")
      .digest("hex")

    expect(signature).toBe(expectedHash)
  })
})
