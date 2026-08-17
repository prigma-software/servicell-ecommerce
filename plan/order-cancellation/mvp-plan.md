# Order Cancellation, Payment Collection & Audit Logging - Implementation Plan (MVP)

## Checklist & Phases

### Phase 1: Database Migrations
- [x] Create migration `supabase/migrations/20260815000000_add_order_cancellation_and_audit_logs.sql` (applied via CLI).
- [x] Create migration `supabase/migrations/20260815000001_add_is_paid_to_orders.sql` (applied via CLI).
  - Add `is_paid` boolean column to `orders`.
  - Default existing Wompi orders to `is_paid = true`.

### Phase 2: State Machine & Backend Services
- [x] Order State Machine in `src/features/orders/services/orderStatusTransitions.ts`.
- [x] Audit Logging Service in `src/features/admin/services/auditService.ts`.
- [x] Service function `markOrderAsPaid(orderId)` in `orderService.ts`.
- [x] Service function `cancelOrder(orderId, reason)` with atomic stock rollback in `orderService.ts`.
- [x] Server actions in `src/features/orders/actions/orderActions.ts`:
  - `approveManualOrder(orderId)` (Approves for dispatch)
  - `markOrderAsPaid(orderId)` (Confirms payment collection)
  - `cancelOrder(orderId, reason)` (Cancels from PENDING, PENDING_MANUAL, or APPROVED)
- [x] Dashboard revenue filtering to only sum `is_paid = true` / Wompi approved orders.

### Phase 3: UI Implementation
- [x] Update `OrderDetailsCard.tsx`:
  - Show "Confirmar Pago Recibido" when `status === 'APPROVED'` and `!order.is_paid`.
  - Show "Cancelar Compra" for `PENDING_MANUAL`, `APPROVED (unpaid)`, and `APPROVED (paid)`.
  - Display clear badges: "Aprobada (Pendiente de Cobro)" vs "Aprobada y Pagada" vs "Cancelada".
- [x] Update `CancelOrderModal.tsx` with non-payment and return presets.

### Phase 4: Verification & Automated Tests
- [x] Vitest test suite (`npm run test:run`).
