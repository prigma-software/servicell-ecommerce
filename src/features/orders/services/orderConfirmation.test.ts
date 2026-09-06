import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  sendOrderNotification,
  sendOrderConfirmationEmail,
  sendManualOrderCreatedEmail,
  type OrderNotificationData,
} from "./orderConfirmation"
import { whatsappService } from "@/shared/services/whatsapp.service"
import { notificationsConfig } from "@/config/notifications.config"

const mockResendSend = vi.fn().mockResolvedValue({ data: { id: "resend_123" }, error: null })

vi.mock("resend", () => {
  return {
    Resend: class {
      emails = {
        send: mockResendSend,
      }
    },
  }
})

describe("orderConfirmation notifications", () => {
  const sampleOrder: OrderNotificationData = {
    orderId: "ord_123456789",
    customerName: "Carlos Gómez",
    customerEmail: "carlos@example.com",
    customerPhone: "3001234567",
    shippingAddress: "Calle 10 # 5-20",
    totalAmount: 150000,
    items: [
      { name: "Producto Test", quantity: 2, price_at_purchase: 75000, sku_code: "SKU-01" },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = "re_test_key"
    notificationsConfig.channels.email = true
    notificationsConfig.channels.whatsapp = true
    notificationsConfig.whatsapp.useTemplates = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should send whatsapp template when whatsapp channel is enabled and useTemplates is true", async () => {
    notificationsConfig.channels.email = false
    notificationsConfig.channels.whatsapp = true
    notificationsConfig.whatsapp.useTemplates = true

    const sendTemplateSpy = vi.spyOn(whatsappService, "sendTemplate").mockResolvedValue({
      success: true,
      messageId: "wamid.123",
    })

    await sendOrderNotification(sampleOrder, "CONFIRMATION")

    expect(sendTemplateSpy).toHaveBeenCalledTimes(1)
    expect(sendTemplateSpy).toHaveBeenCalledWith(
      "3001234567",
      notificationsConfig.whatsapp.templates.orderConfirmation,
      ["Carlos Gómez", "ORD_1234", expect.stringContaining("150.000"), expect.stringContaining("/orders")]
    )
  })

  it("should send whatsapp text when useTemplates is false", async () => {
    notificationsConfig.channels.email = false
    notificationsConfig.channels.whatsapp = true
    notificationsConfig.whatsapp.useTemplates = false

    const sendTextSpy = vi.spyOn(whatsappService, "sendText").mockResolvedValue({
      success: true,
      messageId: "wamid.123",
    })

    await sendOrderNotification(sampleOrder, "CONFIRMATION")

    expect(sendTextSpy).toHaveBeenCalledTimes(1)
    expect(sendTextSpy).toHaveBeenCalledWith(
      "3001234567",
      expect.stringContaining("¡Pedido Confirmado!")
    )
  })

  it("should notify via WhatsApp even if customerEmail is missing", async () => {
    notificationsConfig.channels.email = true
    notificationsConfig.channels.whatsapp = true
    notificationsConfig.whatsapp.useTemplates = false

    const sendTextSpy = vi.spyOn(whatsappService, "sendText").mockResolvedValue({
      success: true,
      messageId: "wamid.123",
    })

    const orderWithoutEmail = { ...sampleOrder, customerEmail: "" }
    await sendOrderNotification(orderWithoutEmail, "CONFIRMATION")

    expect(sendTextSpy).toHaveBeenCalledTimes(1)
    expect(mockResendSend).not.toHaveBeenCalled()
  })

  it("should notify via Resend even if customerPhone is missing", async () => {
    notificationsConfig.channels.email = true
    notificationsConfig.channels.whatsapp = true

    const sendTemplateSpy = vi.spyOn(whatsappService, "sendTemplate")
    const sendTextSpy = vi.spyOn(whatsappService, "sendText")

    const orderWithoutPhone = { ...sampleOrder, customerPhone: null }
    await sendOrderNotification(orderWithoutPhone, "CONFIRMATION")

    expect(mockResendSend).toHaveBeenCalledTimes(1)
    expect(sendTemplateSpy).not.toHaveBeenCalled()
    expect(sendTextSpy).not.toHaveBeenCalled()
  })

  it("should dispatch to both Resend and WhatsApp in parallel when both channels are enabled", async () => {
    notificationsConfig.channels.email = true
    notificationsConfig.channels.whatsapp = true
    notificationsConfig.whatsapp.useTemplates = true

    const sendTemplateSpy = vi.spyOn(whatsappService, "sendTemplate").mockResolvedValue({
      success: true,
      messageId: "wamid.123",
    })

    await sendOrderNotification(sampleOrder, "CONFIRMATION")

    expect(mockResendSend).toHaveBeenCalledTimes(1)
    expect(sendTemplateSpy).toHaveBeenCalledTimes(1)
  })

  it("should ensure failure in Resend does NOT prevent WhatsApp notification from sending (Promise.allSettled)", async () => {
    notificationsConfig.channels.email = true
    notificationsConfig.channels.whatsapp = true
    notificationsConfig.whatsapp.useTemplates = true

    mockResendSend.mockRejectedValueOnce(new Error("Resend server error 500"))
    const sendTemplateSpy = vi.spyOn(whatsappService, "sendTemplate").mockResolvedValue({
      success: true,
      messageId: "wamid.123",
    })

    await expect(sendOrderNotification(sampleOrder, "CONFIRMATION")).resolves.not.toThrow()
    expect(sendTemplateSpy).toHaveBeenCalledTimes(1)
  })

  it("should ensure failure in WhatsApp does NOT prevent Resend notification from sending", async () => {
    notificationsConfig.channels.email = true
    notificationsConfig.channels.whatsapp = true
    notificationsConfig.whatsapp.useTemplates = true

    const sendTemplateSpy = vi.spyOn(whatsappService, "sendTemplate").mockRejectedValueOnce(new Error("Network disconnect"))

    await expect(sendOrderNotification(sampleOrder, "CONFIRMATION")).resolves.not.toThrow()
    expect(mockResendSend).toHaveBeenCalledTimes(1)
  })

  it("should dispatch manual order template when type is MANUAL_PENDING and useTemplates is true", async () => {
    notificationsConfig.channels.email = true
    notificationsConfig.channels.whatsapp = true
    notificationsConfig.whatsapp.useTemplates = true

    const sendTemplateSpy = vi.spyOn(whatsappService, "sendTemplate").mockResolvedValue({
      success: true,
      messageId: "wamid.123",
    })

    await sendOrderNotification(sampleOrder, "MANUAL_PENDING")

    expect(sendTemplateSpy).toHaveBeenCalledWith(
      "3001234567",
      notificationsConfig.whatsapp.templates.manualOrderPending,
      expect.any(Array)
    )
    expect(mockResendSend).toHaveBeenCalledTimes(1)
  })

  it("should do nothing when all channels are disabled", async () => {
    notificationsConfig.channels.email = false
    notificationsConfig.channels.whatsapp = false

    const sendTextSpy = vi.spyOn(whatsappService, "sendText")
    const sendTemplateSpy = vi.spyOn(whatsappService, "sendTemplate")

    await sendOrderNotification(sampleOrder, "CONFIRMATION")

    expect(sendTextSpy).not.toHaveBeenCalled()
    expect(sendTemplateSpy).not.toHaveBeenCalled()
    expect(mockResendSend).not.toHaveBeenCalled()
  })

  it("should support public facade functions for backwards compatibility", async () => {
    const sendTemplateSpy = vi.spyOn(whatsappService, "sendTemplate").mockResolvedValue({
      success: true,
      messageId: "wamid.123",
    })

    await sendOrderConfirmationEmail(sampleOrder)
    expect(sendTemplateSpy).toHaveBeenCalledTimes(1)
    expect(mockResendSend).toHaveBeenCalledTimes(1)

    await sendManualOrderCreatedEmail(sampleOrder)
    expect(sendTemplateSpy).toHaveBeenCalledTimes(2)
    expect(mockResendSend).toHaveBeenCalledTimes(2)
  })
})
