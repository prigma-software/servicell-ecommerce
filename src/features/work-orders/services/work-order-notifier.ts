import {
  IWorkOrderNotificationChannel,
  IWorkOrderNotificationPayload,
} from "../types/notification.types";
import { WorkOrder } from "../types/work-order.types";
import { notificationsConfig } from "@/config/notifications.config";
import { ResendNotificationAdapter } from "./resend-notification.adapter";
import { WhatsAppNotificationAdapter } from "./whatsapp-notification.adapter";

export const workOrderStatusMap: Record<string, string> = {
  DRAFT: "Borrador",
  RECEIVED: "Recibido",
  IN_PROGRESS: "En Progreso",
  ON_HOLD: "En Pausa",
  COMPLETED: "Completado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export class WorkOrderNotifier {
  private readonly appUrl: string;
  private readonly channels: IWorkOrderNotificationChannel[];

  constructor(channels?: IWorkOrderNotificationChannel[]) {
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (channels) {
      this.channels = channels;
    } else {
      const activeChannels: IWorkOrderNotificationChannel[] = [];
      if (notificationsConfig.channels.email) {
        activeChannels.push(new ResendNotificationAdapter());
      }
      if (notificationsConfig.channels.whatsapp) {
        activeChannels.push(new WhatsAppNotificationAdapter());
      }
      this.channels = activeChannels;
    }
  }

  async notifyCreation(order: WorkOrder): Promise<void> {
    if (!order.customer_email && !order.customer_phone) {
      return;
    }

    if (this.channels.length === 0) {
      return;
    }

    const trackingUrl = `${this.appUrl}/tracking?id=${order.tracking_id}`;
    const payload: IWorkOrderNotificationPayload = {
      order,
      trackingUrl,
      type: "CREATION",
    };

    console.log(
      `🔔 [WorkOrderNotifier] Despachando notificación de creación para orden ${order.tracking_id} a ${this.channels.length} canal(es).`
    );

    await Promise.allSettled(this.channels.map((channel) => channel.send(payload)));
  }

  async notifyStatusChange(order: WorkOrder, newStatus: string): Promise<void> {
    if (!order.customer_email && !order.customer_phone) {
      return;
    }

    if (this.channels.length === 0) {
      return;
    }

    const trackingUrl = `${this.appUrl}/tracking?id=${order.tracking_id}`;
    const statusEs = workOrderStatusMap[newStatus] || newStatus;

    const payload: IWorkOrderNotificationPayload = {
      order,
      trackingUrl,
      type: "STATUS_CHANGE",
      newStatus,
      statusEs,
    };

    console.log(
      `🔔 [WorkOrderNotifier] Despachando actualización de estado (${statusEs}) para orden ${order.tracking_id} a ${this.channels.length} canal(es).`
    );

    await Promise.allSettled(this.channels.map((channel) => channel.send(payload)));
  }
}
