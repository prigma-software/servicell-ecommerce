export type OrderStatus = "PENDING" | "APPROVED" | "DECLINED" | "ERROR" | "PENDING_MANUAL"

export type OrderItem = {
  id: string
  product_id: string
  variant_id?: string
  quantity: number
  price?: number
  name?: string
}

// Order item con relaciones para queries completas
export type OrderItemWithRelations = {
  id: string
  order_id: string
  product_id: string
  variant_id: string | null
  quantity: number
  price_at_purchase: number
  products: {
    id: string
    name: string
    image_url: string | null
  } | null
  product_skus: {
    id: string
    sku_code: string
  } | null
}

// Order con relaciones para queries completas
export type OrderWithRelations = {
  id: string
  user_id: string
  total_amount: number
  status: OrderStatus
  payment_method?: "wompi" | "manual" | string | null
  wompi_transaction_id: string | null
  customer_name: string
  customer_email: string
  customer_phone?: string | null
  shipping_address: string
  shipping_cost?: number | null
  shipping_zone_id?: string | null
  stock_returned?: boolean
  is_paid?: boolean
  needs_manual_review?: boolean
  cancellation_reason?: string | null
  cancelled_at?: string | null
  cancelled_by?: string | null
  created_at: string
  order_items?: OrderItemWithRelations[]
  profiles?: {
    email: string
  } | null
  shipping_zones?: {
    name: string
  } | null
}

// Filtros para listado de órdenes
export type OrderFilters = {
  status?: OrderStatus | "ALL"
  search?: string
  page?: number
  pageSize?: number
}

// Resultado paginado
export type PaginatedOrders = {
  orders: OrderWithRelations[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Registro de auditoría
export type AuditLog = {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  target_type: string
  target_id: string
  reason: string | null
  metadata: Record<string, unknown>
  created_at: string
}