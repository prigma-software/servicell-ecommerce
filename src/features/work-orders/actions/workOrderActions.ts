"use server";

import { createClient } from "@/lib/supabase/server";
import { WorkOrder, WorkOrderStatus, CreateWorkOrderDTO } from "../types/work-order.types";
import { revalidatePath } from "next/cache";
import { WorkOrderNotifier } from "../services/work-order-notifier";

export async function createWorkOrder(data: CreateWorkOrderDTO) {
  const supabase = await createClient();

  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .insert({
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email || null,
      custom_metadata: data.custom_metadata,
      estimated_cost: data.estimated_cost || null,
      notes: data.notes || null,
      status: "DRAFT",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating work order:", error);
    return { error: error.message };
  }

  // Notify user about creation
  console.log(`🔔 [WorkOrderActions] Iniciando notificación para nueva orden: ${workOrder.id}`);
  const notifier = new WorkOrderNotifier();
  await notifier.notifyCreation(workOrder as WorkOrder);
  console.log(`🔔 [WorkOrderActions] Notificación de creación finalizada.`);

  revalidatePath("/admin/work-orders");
  return { data: workOrder };
}

export async function updateWorkOrderStatus(id: string, newStatus: WorkOrderStatus) {
  const supabase = await createClient();

  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating work order status:", error);
    return { error: error.message };
  }

  // Notify user
  const notifier = new WorkOrderNotifier();
  await notifier.notifyStatusChange(workOrder as WorkOrder, newStatus);

  revalidatePath(`/admin/work-orders`);
  revalidatePath(`/admin/work-orders/${id}`);
  return { data: workOrder };
}

export async function addEvidence(workOrderId: string, stage: string, imageUrl: string, notes?: string) {
  const supabase = await createClient();

  const { data: evidence, error } = await supabase
    .from("work_order_evidence")
    .insert({
      work_order_id: workOrderId,
      stage,
      image_url: imageUrl,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding evidence:", error);
    return { error: error.message };
  }

  revalidatePath(`/admin/work-orders/${workOrderId}`);
  return { data: evidence };
}

export async function closeWorkOrderAndBill(
  id: string,
  data: {
    resolution_note: string;
    final_cost: number;
    payment_method: string;
    payments?: { method: string; amount: number }[];
    amount_received?: number;
    change_amount?: number;
  }
) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: "No autorizado" };

  const { data: workOrder, error: fetchError } = await supabase
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !workOrder) return { error: "Orden no encontrada" };

  // Call POS Sale Service (using dynamic import to avoid circular dependencies if any)
  const { createSale } = await import("@/features/pos/services/posSaleService");

  try {
    // We pass undefined for product_id so that the DB RPC `decrement_pos_stock` skips it.
    await createSale(authData.user.id, {
      customer_name: workOrder.customer_name,
      items: [
        {
          name: `Servicio Técnico - Orden #${workOrder.tracking_id}`,
          quantity: 1,
          unit_price: data.final_cost,
          discount_pct: 0,
          subtotal: data.final_cost,
          product_id: undefined as any,
          sku: null,
        },
      ],
      discount_amount: 0,
      subtotal: data.final_cost,
      total: data.final_cost,
      payment_method: data.payment_method,
      amount_received: data.amount_received,
      change_amount: data.change_amount,
      payments: data.payments,
      notes: data.resolution_note,
      channel: "work_order",
      work_order_id: workOrder.id,
    });

    // Update work order status
    const { error: updateError } = await supabase
      .from("work_orders")
      .update({
        status: "DELIVERED",
        resolution_note: data.resolution_note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating work order after billing:", updateError);
      return { error: updateError.message };
    }

    const notifier = new WorkOrderNotifier();
    await notifier.notifyStatusChange(workOrder as WorkOrder, "DELIVERED");

    revalidatePath(`/admin/work-orders`);
    revalidatePath(`/admin/work-orders/${id}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error closing work order and billing:", error);
    return { error: error.message || "Error cerrando orden de trabajo" };
  }
}

