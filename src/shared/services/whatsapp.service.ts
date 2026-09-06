import { formatWhatsAppPhone, maskPhoneForLogs } from "../utils/phone.utils";
import { notificationsConfig } from "../../config/notifications.config";

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: any;
}

export class WhatsAppService {
  private readonly phoneNumberId: string | undefined;
  private readonly accessToken: string | undefined;
  private readonly apiVersion: string;
  private readonly timeoutMs: number = 4500;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.apiVersion = process.env.WHATSAPP_API_VERSION || "v22.0";
  }

  /**
   * Checks if required credentials are configured.
   */
  public isConfigured(): boolean {
    return Boolean(this.phoneNumberId && this.accessToken);
  }

  /**
   * Sends a pre-approved Meta message template (Required for outbound production messages outside 24h window).
   * 
   * @param to Recipient phone number (normalized internally)
   * @param templateName Name of the template in Meta Business Manager
   * @param bodyParameters Ordered array of strings matching placeholders {{1}}, {{2}}, etc.
   * @param languageCode Template language (default 'es')
   */
  public async sendTemplate(
    to: string,
    templateName: string,
    bodyParameters: string[],
    languageCode?: string
  ): Promise<WhatsAppSendResult> {
    const formattedPhone = formatWhatsAppPhone(to, notificationsConfig.whatsapp.defaultCountryCode);
    const maskedPhone = maskPhoneForLogs(to);

    if (!formattedPhone) {
      console.warn(`⚠️ [WhatsApp] Número de teléfono inválido para envío: ${maskedPhone}`);
      return { success: false, error: "INVALID_PHONE_NUMBER" };
    }

    const lang = languageCode || notificationsConfig.whatsapp.defaultLanguageCode;

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: lang,
        },
        components: [
          {
            type: "body",
            parameters: bodyParameters.map((param) => ({
              type: "text",
              text: String(param),
            })),
          },
        ],
      },
    };

    return this.executePost(payload, maskedPhone, `template: ${templateName}`);
  }

  /**
   * Sends a plain text message.
   * Note: In production, Meta rejects free-form text messages outside the 24-hour customer service window (Error 131047).
   * Use this method for local dev/sandbox testing or interactive customer replies.
   * 
   * @param to Recipient phone number
   * @param message Text body to send
   */
  public async sendText(to: string, message: string): Promise<WhatsAppSendResult> {
    const formattedPhone = formatWhatsAppPhone(to, notificationsConfig.whatsapp.defaultCountryCode);
    const maskedPhone = maskPhoneForLogs(to);

    if (!formattedPhone) {
      console.warn(`⚠️ [WhatsApp] Número de teléfono inválido para envío: ${maskedPhone}`);
      return { success: false, error: "INVALID_PHONE_NUMBER" };
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "text",
      text: {
        body: message,
      },
    };

    return this.executePost(payload, maskedPhone, "free-form text");
  }

  /**
   * Internal executor with strict timeout and resilient error handling.
   */
  private async executePost(payload: any, maskedPhone: string, typeInfo: string): Promise<WhatsAppSendResult> {
    if (!this.isConfigured()) {
      console.warn(
        "⚠️ [WhatsApp] WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN no están configurados. Envío omitido."
      );
      return { success: false, error: "MISSING_CREDENTIALS" };
    }

    const endpoint = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      console.log(`📱 [WhatsApp] Enviando notificación (${typeInfo}) a: ${maskedPhone}`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorDetail = data.error || {};
        console.error(
          `❌ [WhatsApp] Error de Meta API al enviar a ${maskedPhone}:`,
          JSON.stringify({
            code: errorDetail.code,
            subcode: errorDetail.error_subcode,
            message: errorDetail.message,
            fbtrace_id: errorDetail.fbtrace_id,
          })
        );
        return { success: false, error: errorDetail };
      }

      const messageId = data.messages?.[0]?.id;
      console.log(`✅ [WhatsApp] Notificación enviada con éxito a ${maskedPhone}. WAMID: ${messageId}`);
      return { success: true, messageId };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        console.error(`⚠️ [WhatsApp] Timeout alcanzado (${this.timeoutMs}ms) esperando respuesta de Meta API.`);
        return { success: false, error: "TIMEOUT" };
      }
      console.error(`❌ [WhatsApp] Error inesperado en la llamada a Meta API:`, err.message || err);
      return { success: false, error: err };
    }
  }
}

// Export singleton instance for app-wide use
export const whatsappService = new WhatsAppService();
