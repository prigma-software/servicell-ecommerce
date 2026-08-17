export const STATUS_BADGE_STYLES: Record<string, string> = {
  APPROVED: "bg-success-muted text-success border-success",
  PENDING: "bg-warning-muted text-warning border-warning",
  PENDING_MANUAL: "bg-warning-muted text-warning border-warning",
  DECLINED: "bg-danger-muted text-danger border-danger",
  ERROR: "bg-danger-muted text-danger border-danger",
}

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente (En línea)",
  PENDING_MANUAL: "Contra Entrega (Por Despachar)",
  APPROVED: "Aprobada",
  DECLINED: "Cancelada",
  ERROR: "Error",
}

export const STATUS_BADGE_DEFAULT = "bg-muted text-muted-foreground border-border"

export const RECENT_ORDER_STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-success-muted text-success",
  PENDING: "bg-warning-muted text-warning",
  PENDING_MANUAL: "bg-warning-muted text-warning",
  DECLINED: "bg-danger-muted text-danger",
  ERROR: "bg-danger-muted text-danger",
}

export const RECENT_ORDER_STATUS_DEFAULT = "bg-danger-muted text-danger"
