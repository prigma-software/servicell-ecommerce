import { IWorkOrderNotificationChannel, IWorkOrderNotificationPayload } from "../types/notification.types";
import { storeBranding } from "@/lib/constants/branding-store";
import { Resend } from "resend";

export class ResendNotificationAdapter implements IWorkOrderNotificationChannel {
  public readonly name = "Resend (Email)";
  private readonly appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  private buildEmailTemplate(title: string, message: string, trackingUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0a; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
          .container { max-width: 600px; margin: 40px auto; background-color: #141414; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden; border: 1px solid #27272a; }
          .header { background-color: #0a0a0a; padding: 32px 40px; text-align: center; border-bottom: 1px solid #27272a; }
          .header img { height: 48px; margin: 0 auto; display: block; }
          .content { padding: 40px; }
          .title { color: #fafafa; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 20px; }
          .message { color: #a1a1aa; font-size: 16px; line-height: 1.6; margin-bottom: 32px; }
          .button-container { text-align: center; margin-bottom: 32px; }
          .button { background-color: #8a5cf6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.2s; box-shadow: 0 2px 4px rgba(138, 92, 246, 0.3); }
          .button:hover { background-color: #7c3aed; }
          .footer { background-color: #0a0a0a; padding: 24px 40px; text-align: center; border-top: 1px solid #27272a; }
          .footer p { color: #52525b; font-size: 13px; margin: 0 0 8px 0; line-height: 1.5; }
          .link-fallback { color: #8a5cf6; text-decoration: underline; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://prigma.net/_next/image?url=%2Fimages%2Fprigma_logo_sin_fondo.png&w=256&q=75" alt="${storeBranding.name}" />
          </div>
          <div class="content">
            <h2 class="title">${title}</h2>
            <div class="message">${message}</div>
            <div class="button-container">
              <a href="${trackingUrl}" class="button" style="color: #ffffff !important;">Rastrear mi Orden</a>
            </div>
          </div>
          <div class="footer">
            <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
            <p><a href="${trackingUrl}" class="link-fallback">${trackingUrl}</a></p>
            <p style="margin-top: 16px;">© ${new Date().getFullYear()} ${storeBranding.legal.copyrightName}. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async send(payload: IWorkOrderNotificationPayload): Promise<boolean> {
    const { order, trackingUrl, type, statusEs } = payload;
    const recipientEmail = order.customer_email;

    if (!recipientEmail) {
      // Cliente sin email registrado (ej. taller presencial); se omite el canal de email limpiamente
      return false;
    }

    try {
      const apiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL || "PRIGMA <onboarding@resend.dev>";

      if (!apiKey || apiKey === "re_REEMPLAZAR_CON_API_KEY_DE_RESEND") {
        console.warn("⚠️ [WorkOrderNotifier] RESEND_API_KEY no definida. Omitiendo envío de correo.");
        return false;
      }

      console.log(`📧 [WorkOrderNotifier] Intentando enviar correo a: ${recipientEmail} desde: ${fromEmail}`);

      const resend = new Resend(apiKey);
      const isCreation = type === "CREATION";

      const subject = isCreation
        ? `Hemos recibido tu orden: ${order.tracking_id}`
        : `Actualización de tu orden ${order.tracking_id}`;

      const title = isCreation
        ? "Orden de Servicio Recibida"
        : "Actualización de Servicio";

      const message = isCreation
        ? `Hola ${order.customer_name}, hemos creado una nueva orden de servicio para ti. Puedes hacer seguimiento del progreso, ver las fotos y el costo estimado en tiempo real a través de nuestro portal de rastreo.`
        : `Hola ${order.customer_name}, tu orden de servicio ha cambiado al estado: <strong>${statusEs || order.status}</strong>. Para más detalles, ingresa al portal de rastreo.`;

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: recipientEmail,
        subject,
        html: this.buildEmailTemplate(title, message, trackingUrl),
      });

      if (error) {
        console.error("❌ [WorkOrderNotifier] Error en Resend API:", error);
        return false;
      }

      console.log("✅ [WorkOrderNotifier] Correo enviado exitosamente. ID:", data?.id);
      return true;
    } catch (error) {
      console.error("❌ [WorkOrderNotifier] Error inesperado enviando correo:", error);
      return false;
    }
  }

  // Método puente para compatibilidad
  async sendNotification(payload: any): Promise<boolean> {
    return this.send(payload);
  }
}
