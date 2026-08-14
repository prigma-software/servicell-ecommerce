import { INotificationService } from '../types/notification.types';
import { WorkOrder } from '../types/work-order.types';
import { storeBranding } from '@/lib/constants/branding-store';

export class WorkOrderNotifier {
  private readonly appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  constructor(private readonly notificationService: INotificationService) {}

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
          .button { background-color: #dc2626; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.2s; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3); }
          .button:hover { background-color: #b91c1c; }
          .footer { background-color: #0a0a0a; padding: 24px 40px; text-align: center; border-top: 1px solid #27272a; }
          .footer p { color: #52525b; font-size: 13px; margin: 0 0 8px 0; line-height: 1.5; }
          .link-fallback { color: #dc2626; text-decoration: underline; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${this.appUrl}${storeBranding.assets.logo}" alt="${storeBranding.name}" />
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

  async notifyCreation(order: WorkOrder) {
    if (!order.customer_email) return;

    const trackingUrl = `${this.appUrl}/tracking?id=${order.tracking_id}`;
    
    await this.notificationService.sendNotification({
      to: order.customer_email,
      subject: `Hemos recibido tu orden: ${order.tracking_id}`,
      body: this.buildEmailTemplate(
        "Orden de Servicio Recibida",
        `Hola ${order.customer_name}, hemos creado una nueva orden de servicio para ti. Puedes hacer seguimiento del progreso, ver las fotos y el costo estimado en tiempo real a través de nuestro portal de rastreo.`,
        trackingUrl
      ),
      workOrderId: order.id,
      status: order.status
    });
  }

  async notifyStatusChange(order: WorkOrder, newStatus: string) {
    if (!order.customer_email) return;
    
    const trackingUrl = `${this.appUrl}/tracking?id=${order.tracking_id}`;

    // Optionally map standard statuses to Spanish in the email body
    const statusMap: Record<string, string> = {
      DRAFT: 'Borrador',
      RECEIVED: 'Recibido',
      IN_PROGRESS: 'En Progreso',
      ON_HOLD: 'En Pausa',
      COMPLETED: 'Completado',
      DELIVERED: 'Entregado',
      CANCELLED: 'Cancelado'
    };
    
    const statusEs = statusMap[newStatus] || newStatus;

    await this.notificationService.sendNotification({
      to: order.customer_email,
      subject: `Actualización de tu orden ${order.tracking_id}`,
      body: this.buildEmailTemplate(
        "Actualización de Servicio",
        `Hola ${order.customer_name}, tu orden de servicio ha cambiado al estado: <strong>${statusEs}</strong>. Para más detalles, ingresa al portal de rastreo.`,
        trackingUrl
      ),
      workOrderId: order.id,
      status: newStatus
    });
  }
}
