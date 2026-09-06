import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { processWompiWebhook } from "./wompiWebhookService";

import { sendOrderConfirmationEmail } from "@/features/orders/services/orderConfirmation";
import { findOrderWithItemsForEmail } from "@/features/orders/repositories/orderRepository";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/features/orders/services/orderConfirmation", () => ({
  sendOrderConfirmationEmail: vi.fn(),
}));

vi.mock("@/features/orders/repositories/orderRepository", () => ({
  findOrderWithItemsForEmail: vi.fn().mockResolvedValue(null),
}));

describe("processWompiWebhook", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, WOMPI_EVENTS_SECRET: "secret_test_123" };
  });

  function generateValidChecksum(
    properties: string[],
    data: Record<string, unknown>,
    timestamp: number,
    secret: string
  ): string {
    let concatenated = "";
    for (const prop of properties) {
      const parts = prop.split(".");
      let val: unknown = data;
      for (const part of parts) {
        val = (val as Record<string, unknown>)?.[part];
      }
      concatenated += String(val ?? "");
    }
    return crypto.createHash("sha256").update(`${concatenated}${timestamp}${secret}`).digest("hex");
  }

  it("should reject event if timestamp is older than 10 minutes (Anti-Replay)", async () => {
    const elevenMinutesAgo = Date.now() - 11 * 60 * 1000;
    const event = {
      event: "transaction.updated",
      data: {
        transaction: {
          id: "tx-1",
          reference: "order-1",
          status: "APPROVED" as const,
          amount_in_cents: 1000000,
        },
      },
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
        checksum: "any_checksum",
      },
      timestamp: elevenMinutesAgo,
    };

    const result = await processWompiWebhook(event, null);
    expect(result.received).toBe(false);
    expect(result.error).toBe("Timestamp expired or invalid");
  });

  it("should safely reject invalid checksum without timingSafeEqual buffer error on disparate lengths", async () => {
    const event = {
      event: "transaction.updated",
      data: {
        transaction: {
          id: "tx-1",
          reference: "order-1",
          status: "APPROVED" as const,
          amount_in_cents: 1000000,
        },
      },
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
        checksum: "short_invalid_checksum",
      },
      timestamp: Date.now(),
    };

    const result = await processWompiWebhook(event, null);
    expect(result.received).toBe(false);
    expect(result.error).toBe("Firma inválida");
  });

  it("should reject if transaction amount is less than the order amount in DB", async () => {
    const timestamp = Date.now();
    const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
    const event = {
      event: "transaction.updated",
      data: {
        transaction: {
          id: "tx-underpaid",
          reference: "order-1",
          status: "APPROVED" as const,
          amount_in_cents: 50000, // 500 COP in cents
        },
      },
      signature: {
        properties,
        checksum: "",
      },
      timestamp,
    };

    event.signature.checksum = generateValidChecksum(
      properties,
      event.data,
      timestamp,
      "secret_test_123"
    );

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "order-1",
              reservation_id: "res-1",
              status: "PENDING",
              total_amount: 5000, // 5000 COP (expected 500000 cents)
            },
            error: null,
          }),
        }),
      }),
    });

    const result = await processWompiWebhook(event, null);
    expect(result.received).toBe(false);
    expect(result.error).toBe("Monto insuficiente");
  });

  it("should process approved transaction when signature, timestamp, and amount match", async () => {
    const timestamp = Date.now();
    const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
    const event = {
      event: "transaction.updated",
      data: {
        transaction: {
          id: "tx-valid",
          reference: "order-1",
          status: "APPROVED" as const,
          amount_in_cents: 500000, // 5000 COP in cents
        },
      },
      signature: {
        properties,
        checksum: "",
      },
      timestamp,
    };

    event.signature.checksum = generateValidChecksum(
      properties,
      event.data,
      timestamp,
      "secret_test_123"
    );

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "order-1",
              reservation_id: "res-1",
              status: "PENDING",
              total_amount: 5000,
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mockRpc.mockResolvedValue({ data: "OK", error: null });

    const result = await processWompiWebhook(event, null);
    expect(result.received).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("process_wompi_approved", {
      p_order_id: "order-1",
      p_reservation_id: "res-1",
    });
  });

  it("should trigger confirmation with customerPhone when order has only customer_phone", async () => {
    const timestamp = Date.now();
    const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
    const event = {
      event: "transaction.updated",
      data: {
        transaction: {
          id: "tx-phone",
          reference: "order-phone-only",
          status: "APPROVED" as const,
          amount_in_cents: 500000,
        },
      },
      signature: {
        properties,
        checksum: "",
      },
      timestamp,
    };

    event.signature.checksum = generateValidChecksum(
      properties,
      event.data,
      timestamp,
      "secret_test_123"
    );

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "order-phone-only",
              reservation_id: "res-phone",
              status: "PENDING",
              total_amount: 5000,
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mockRpc.mockResolvedValue({ data: "OK", error: null });

    vi.mocked(findOrderWithItemsForEmail).mockResolvedValueOnce({
      id: "order-phone-only",
      customer_name: "Ana María",
      customer_email: null,
      customer_phone: "3001234567",
      shipping_address: "Calle 123",
      total_amount: 5000,
      order_items: [],
    } as any);

    const result = await processWompiWebhook(event, null);
    expect(result.received).toBe(true);
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-phone-only",
        customerName: "Ana María",
        customerEmail: null,
        customerPhone: "3001234567",
        totalAmount: 5000,
      })
    );
  });

  it("should maintain backwards compatibility when order has only customer_email", async () => {
    const timestamp = Date.now();
    const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
    const event = {
      event: "transaction.updated",
      data: {
        transaction: {
          id: "tx-email",
          reference: "order-email-only",
          status: "APPROVED" as const,
          amount_in_cents: 500000,
        },
      },
      signature: {
        properties,
        checksum: "",
      },
      timestamp,
    };

    event.signature.checksum = generateValidChecksum(
      properties,
      event.data,
      timestamp,
      "secret_test_123"
    );

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "order-email-only",
              reservation_id: "res-email",
              status: "PENDING",
              total_amount: 5000,
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mockRpc.mockResolvedValue({ data: "OK", error: null });

    vi.mocked(findOrderWithItemsForEmail).mockResolvedValueOnce({
      id: "order-email-only",
      customer_name: "Pedro Gómez",
      customer_email: "pedro@example.com",
      customer_phone: null,
      shipping_address: "Calle 456",
      total_amount: 5000,
      order_items: [],
    } as any);

    const result = await processWompiWebhook(event, null);
    expect(result.received).toBe(true);
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-email-only",
        customerName: "Pedro Gómez",
        customerEmail: "pedro@example.com",
        customerPhone: null,
        totalAmount: 5000,
      })
    );
  });
});
