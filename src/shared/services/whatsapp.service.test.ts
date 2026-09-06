import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WhatsAppService } from "./whatsapp.service";

describe("WhatsAppService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should report isConfigured false when credentials are missing", () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    const service = new WhatsAppService();
    expect(service.isConfigured()).toBe(false);
  });

  it("should gracefully return MISSING_CREDENTIALS when sending without config", async () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    const service = new WhatsAppService();
    const result = await service.sendText("3001234567", "Hola");
    expect(result.success).toBe(false);
    expect(result.error).toBe("MISSING_CREDENTIALS");
  });

  it("should gracefully return INVALID_PHONE_NUMBER for invalid phone", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    process.env.WHATSAPP_ACCESS_TOKEN = "EAAB...";

    const service = new WhatsAppService();
    const result = await service.sendText("invalid", "Hola");
    expect(result.success).toBe(false);
    expect(result.error).toBe("INVALID_PHONE_NUMBER");
  });

  it("should send template message successfully when Meta responds 200", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    process.env.WHATSAPP_ACCESS_TOKEN = "EAAB_TOKEN";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [{ id: "wamid.HBgLMTc4NjM1NTk5NjYV..." }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const service = new WhatsAppService();
    const result = await service.sendTemplate(
      "3001234567",
      "order_confirmation",
      ["Juan", "ORD-123", "$50.000", "https://example.com"]
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("wamid.HBgLMTc4NjM1NTk5NjYV...");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://graph.facebook.com/v22.0/123456/messages");
    const body = JSON.parse(callArgs[1].body);
    expect(body.type).toBe("template");
    expect(body.to).toBe("573001234567");
    expect(body.template.name).toBe("order_confirmation");
    expect(body.template.components[0].parameters).toHaveLength(4);
  });

  it("should capture Meta error responses without throwing", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    process.env.WHATSAPP_ACCESS_TOKEN = "EAAB_TOKEN";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          code: 131047,
          message: "Re-engagement message: More than 24 hours have passed",
          fbtrace_id: "FBrandom123",
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const service = new WhatsAppService();
    const result = await service.sendText("3001234567", "Hola cliente");

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(131047);
  });

  it("should handle timeout (AbortError) gracefully and return TIMEOUT", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    process.env.WHATSAPP_ACCESS_TOKEN = "EAAB_TOKEN";

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    const mockFetch = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", mockFetch);

    const service = new WhatsAppService();
    const result = await service.sendText("3001234567", "Mensaje con timeout");

    expect(result.success).toBe(false);
    expect(result.error).toBe("TIMEOUT");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle unexpected network exceptions gracefully without throwing", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    process.env.WHATSAPP_ACCESS_TOKEN = "EAAB_TOKEN";

    const networkError = new TypeError("fetch failed");
    const mockFetch = vi.fn().mockRejectedValue(networkError);
    vi.stubGlobal("fetch", mockFetch);

    const service = new WhatsAppService();
    const result = await service.sendText("3001234567", "Mensaje que falla en red");

    expect(result.success).toBe(false);
    expect(result.error.message).toBe("fetch failed");
  });

  it("should allow custom language code in sendTemplate", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    process.env.WHATSAPP_ACCESS_TOKEN = "EAAB_TOKEN";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [{ id: "wamid.CUSTOM_LANG" }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const service = new WhatsAppService();
    const result = await service.sendTemplate(
      "3001234567",
      "shipping_update",
      ["Paquete enviado"],
      "en_US"
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("wamid.CUSTOM_LANG");

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.template.language.code).toBe("en_US");
  });

  it("should not call fetch when phone is invalid or credentials are missing", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    const service = new WhatsAppService();
    await service.sendText("invalid-phone", "test");

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
