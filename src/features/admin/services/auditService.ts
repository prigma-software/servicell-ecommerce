import type { SupabaseClient } from "@supabase/supabase-js"
import type { AuditLog } from "@/features/orders/types/order.types"

export type CreateAuditLogDTO = {
  user_id?: string | null
  user_email?: string | null
  action: string
  target_type: string
  target_id: string
  reason?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Inserts a structured audit log entry.
 */
export async function createAuditLog(
  client: SupabaseClient,
  dto: CreateAuditLogDTO
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await client.from("audit_logs").insert({
      user_id: dto.user_id || null,
      user_email: dto.user_email || null,
      action: dto.action,
      target_type: dto.target_type,
      target_id: dto.target_id,
      reason: dto.reason || null,
      metadata: dto.metadata || {},
    })

    if (error) {
      console.error("Failed to create audit log:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error("Exception in createAuditLog:", err)
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Fetches audit logs for a specific target entity (e.g. an order).
 */
export async function findAuditLogsByTarget(
  client: SupabaseClient,
  targetType: string,
  targetId: string
): Promise<AuditLog[]> {
  const { data, error } = await client
    .from("audit_logs")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch audit logs:", error)
    return []
  }

  return (data as AuditLog[]) ?? []
}
