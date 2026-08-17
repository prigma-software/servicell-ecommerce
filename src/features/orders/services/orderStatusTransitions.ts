import type { OrderStatus } from "@/features/orders/types/order.types"

/**
 * Deterministic State Machine for Order Lifecycles.
 * Defines allowed transitions between order states.
 */
export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  // Pending online payment via Wompi
  PENDING: ["APPROVED", "DECLINED", "ERROR"],

  // Manual payment (Cash on delivery / Transfer) waiting for admin approval or delivery
  PENDING_MANUAL: ["APPROVED", "DECLINED", "ERROR"],

  // Approved and paid/confirmed orders can be cancelled with stock rollback
  APPROVED: ["DECLINED"],

  // Terminal states: once cancelled or failed, cannot transition again to prevent stock corruption
  DECLINED: [],
  ERROR: [],
}

/**
 * Validates whether an order can transition from current to next status.
 */
export function canTransitionOrder(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return true
  const allowed = ORDER_STATUS_FLOW[current]
  return allowed ? allowed.includes(next) : false
}
