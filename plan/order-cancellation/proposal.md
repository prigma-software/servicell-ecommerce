# Order Lifecycle, Cancellation, Stock Reversal & Payment Collection - Technical Proposal

## 1. Overview & Business Objectives
In e-commerce and logistics workflows, specifically for **Cash on Delivery (Pago Contra Entrega / Manual Payment)**, order fulfillment and payment collection happen asynchronously:

1. **Order Creation:** Customer places a manual/cash-on-delivery order (`PENDING_MANUAL`). Stock is immediately decremented to hold units.
2. **Order Approval & Dispatch:** Administrator validates customer data and approves the order for fulfillment (`APPROVED`, `is_paid: false`). The order is packed and dispatched for delivery.
3. **Payment Collection vs. Delivery Failure:**
   - **Case A (Customer Pays Delivery Agent):** Admin confirms the cash/transfer was received (`is_paid: true`). The funds are officially counted in financial dashboard metrics.
   - **Case B (Customer Refuses / Delivery Fails / Cancellation):** Admin cancels the purchase (`DECLINED`), product/variant stock is automatically returned to inventory (`stock_returned: true`), financial metrics exclude the order, and an audit trail is recorded.

---

## 2. Architecture & State Lifecycle

```
[ PENDING_MANUAL ] ──(Admin Approves for Dispatch)──► [ APPROVED (is_paid: false) ]
       │                                                         │
       │                                       ┌─────────────────┴─────────────────┐
       │                                       ▼                                   ▼
       │                          (Agent Collects Cash)                 (Customer Refuses / Return)
       │                                       │                                   │
       │                                       ▼                                   ▼
       │                           [ APPROVED (is_paid: true) ]             [ DECLINED ]
       │                                       │                         (Stock Returned)
       │                                       ▼                                   ▲
       │                          (Late Return / Warranty)                         │
       └───────────────────────────────────────┴───────────────────────────────────┘
```

---

## 3. Database Schema Design (Supabase)

### 1. `orders` Table Enhancements
- `is_paid` (BOOLEAN NOT NULL DEFAULT false): Distinguishes dispatched orders from collected funds. Wompi online transactions are automatically set to `true`.
- `cancellation_reason` (TEXT, nullable): Mandatory reason provided by the administrator when cancelling an order.
- `cancelled_at` (TIMESTAMPTZ, nullable): Timestamp of cancellation.
- `cancelled_by` (UUID, references `auth.users(id)`): Admin user who executed the cancellation.

### 2. `audit_logs` Table
A dedicated immutable audit ledger:
- `id` (UUID PK)
- `user_id` (UUID FK)
- `user_email` (TEXT)
- `action` (TEXT: `'ORDER_APPROVED_FOR_DISPATCH'`, `'PAYMENT_COLLECTED'`, `'ORDER_CANCELLED'`)
- `target_type` (TEXT: `'order'`)
- `target_id` (TEXT)
- `reason` (TEXT)
- `metadata` (JSONB: amounts, items count, previous status)
- `created_at` (TIMESTAMPTZ)

---

## 4. Financial Metrics Invariants (Dashboard)
- **Revenue Calculation:** `onlineRevenue` only aggregates orders where `status = 'APPROVED'` AND (`payment_method = 'wompi'` OR `is_paid = true`).
- **Pending Receivables:** Uncollected dispatched orders (`status = 'APPROVED'` and `is_paid = false`) do not inflate cash-in-hand figures.
- **Cancelled Orders:** Never count towards revenue or best-seller product rankings.
