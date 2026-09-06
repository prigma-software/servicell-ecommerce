import { WorkOrder } from "./work-order.types";

export interface IWorkOrderNotificationPayload {
  order: WorkOrder;
  trackingUrl: string;
  type: "CREATION" | "STATUS_CHANGE";
  newStatus?: string;
  statusEs?: string;
}

export interface IWorkOrderNotificationChannel {
  readonly name: string;
  send(payload: IWorkOrderNotificationPayload): Promise<boolean>;
}

// Aliases de compatibilidad hacia atrás
export type INotificationPayload = IWorkOrderNotificationPayload;
export type INotificationService = IWorkOrderNotificationChannel;
