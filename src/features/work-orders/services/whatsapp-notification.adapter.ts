import { IWorkOrderNotificationChannel, IWorkOrderNotificationPayload } from "../types/notification.types";
import { notificationsConfig } from "@/config/notifications.config";
import { whatsappService } from "@/shared/services/whatsapp.service";

export class WhatsAppNotificationAdapter implements IWorkOrderNotificationChannel {
  public readonly name = "WhatsApp Cloud API";

  async send(payload: IWorkOrderNotificationPayload): Promise<boolean> {
    const { order, trackingUrl, type, statusEs } = payload;
    const recipientPhone = order.customer_phone;

    if (!recipientPhone) {
      // Cliente sin teléfono registrado; se omite el canal de WhatsApp limpiamente
      return false;
    }

    try {
      if (notificationsConfig.whatsapp.useTemplates) {
        // Modo Plantillas Aprobadas de Meta (Producción)
        if (type === "CREATION") {
          const estimatedCostText = order.estimated_cost
            ? `$${Number(order.estimated_cost).toLocaleString("es-CO")}`
            : "Por cotizar";

          // Parámetros: {{1}} Nombre, {{2}} Tracking ID, {{3}} Costo estimado, {{4}} URL tracking
          const params = [
            order.customer_name,
            order.tracking_id,
            estimatedCostText,
            trackingUrl,
          ];

          const result = await whatsappService.sendTemplate(
            recipientPhone,
            notificationsConfig.whatsapp.templates.workOrderCreated,
            params
          );
          return result.success;
        } else {
          // STATUS_CHANGE
          // Parámetros: {{1}} Nombre, {{2}} Tracking ID, {{3}} Estado en español, {{4}} URL tracking
          const params = [
            order.customer_name,
            order.tracking_id,
            statusEs || order.status,
            trackingUrl,
          ];

          const result = await whatsappService.sendTemplate(
            recipientPhone,
            notificationsConfig.whatsapp.templates.workOrderStatusChange,
            params
          );
          return result.success;
        }
      } else {
        // Modo Desarrollo / Sandbox (Texto libre estructurado)
        const isCreation = type === "CREATION";
        const text = isCreation
          ? [
              `🛠️ *Orden de Servicio Recibida* #${order.tracking_id}`,
              ``,
              `Hola *${order.customer_name}*, hemos creado una nueva orden de servicio para tu equipo en nuestro taller.`,
              ``,
              `Puedes hacer seguimiento del progreso, ver las fotos y el presupuesto en tiempo real a través de nuestro portal:`,
              trackingUrl,
            ].join("\n")
          : [
              `🔄 *Actualización de Servicio* #${order.tracking_id}`,
              ``,
              `Hola *${order.customer_name}*, tu orden de servicio ha cambiado al estado: *${statusEs || order.status}*.`,
              ``,
              `Para ver los detalles completos y las fotos del avance, ingresa a nuestro portal de rastreo:`,
              trackingUrl,
            ].join("\n");

        const result = await whatsappService.sendText(recipientPhone, text);
        return result.success;
      }
    } catch (error) {
      console.error("❌ [WorkOrderWhatsAppAdapter] Error inesperado enviando notificación:", error);
      return false;
    }
  }
}
