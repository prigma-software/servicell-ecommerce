import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WorkOrderNotifier } from "./work-order-notifier";
import { WhatsAppNotificationAdapter } from "./whatsapp-notification.adapter";
import { ResendNotificationAdapter } from "./resend-notification.adapter";
import { WorkOrder } from "../types/work-order.types";
import { whatsappService } from "@/shared/services/whatsapp.service";
import { notificationsConfig } from "@/config/notifications.config";

vi.mock("resend", () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: vi.fn().mockResolvedValue({ data: { id: "resend_order_123" }, error: null }),
      },
    })),
  };
});

describe("WorkOrderNotifier and Adapters", () => {
  const sampleWorkOrder: WorkOrder = {
    id: "wo_12345",
    tracking_id: "TK-9876",
    customer_name: "María Rodríguez",
    customer_email: "maria@example.com",
    customer_phone: "3109876543",
    custom_metadata: { brand: "Samsung", model: "S21" },
    estimated_cost: 120000,
    notes: null,
    resolution_note: null,
    status: "RECEIVED",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should support dependency injection of custom channels", async () => {
    const mockChannel = {
      name: "MockChannel",
      send: vi.fn().mockResolvedValue(true),
    };

    const notifier = new WorkOrderNotifier([mockChannel]);
    await notifier.notifyCreation(sampleWorkOrder);

    expect(mockChannel.send).toHaveBeenCalledTimes(1);
    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        order: sampleWorkOrder,
        type: "CREATION",
      })
    );
  });

  it("should dispatch to WhatsApp with template when enabled and useTemplates is true", async () => {
    notificationsConfig.whatsapp.useTemplates = true;

    const sendTemplateSpy = vi.spyOn(whatsappService, "sendTemplate").mockResolvedValue({
      success: true,
      messageId: "wamid.wo.123",
    });

    const adapter = new WhatsAppNotificationAdapter();
    const notifier = new WorkOrderNotifier([adapter]);

    await notifier.notifyCreation(sampleWorkOrder);

    expect(sendTemplateSpy).toHaveBeenCalledTimes(1);
    expect(sendTemplateSpy).toHaveBeenCalledWith(
      "3109876543",
      notificationsConfig.whatsapp.templates.workOrderCreated,
      ["María Rodríguez", "TK-9876", "$120.000", expect.stringContaining("tracking?id=TK-9876")]
    );
  });

  it("should dispatch to WhatsApp with status update in Spanish", async () => {
    notificationsConfig.whatsapp.useTemplates = true;

    const sendTemplateSpy = vi.spyOn(whatsappService, "sendTemplate").mockResolvedValue({
      success: true,
      messageId: "wamid.wo.status",
    });

    const adapter = new WhatsAppNotificationAdapter();
    const notifier = new WorkOrderNotifier([adapter]);

    await notifier.notifyStatusChange(sampleWorkOrder, "COMPLETED");

    expect(sendTemplateSpy).toHaveBeenCalledTimes(1);
    expect(sendTemplateSpy).toHaveBeenCalledWith(
      "3109876543",
      notificationsConfig.whatsapp.templates.workOrderStatusChange,
      ["María Rodríguez", "TK-9876", "Completado", expect.stringContaining("tracking?id=TK-9876")]
    );
  });

  it("should notify via WhatsApp even if customer_email is null", async () => {
    const phoneOnlyOrder: WorkOrder = {
      ...sampleWorkOrder,
      customer_email: null,
    };

    const sendTextSpy = vi.spyOn(whatsappService, "sendText").mockResolvedValue({
      success: true,
      messageId: "wamid.text.123",
    });
    notificationsConfig.whatsapp.useTemplates = false;

    const adapter = new WhatsAppNotificationAdapter();
    const notifier = new WorkOrderNotifier([adapter]);

    await notifier.notifyCreation(phoneOnlyOrder);

    expect(sendTextSpy).toHaveBeenCalledTimes(1);
    expect(sendTextSpy).toHaveBeenCalledWith(
      "3109876543",
      expect.stringContaining("Orden de Servicio Recibida")
    );
  });

  it("should do nothing if both customer_email and customer_phone are absent", async () => {
    const noContactOrder: WorkOrder = {
      ...sampleWorkOrder,
      customer_email: null,
      customer_phone: "",
    };

    const sendTextSpy = vi.spyOn(whatsappService, "sendText");
    const adapter = new WhatsAppNotificationAdapter();
    const notifier = new WorkOrderNotifier([adapter]);

    await notifier.notifyCreation(noContactOrder);

    expect(sendTextSpy).not.toHaveBeenCalled();
  });
});
