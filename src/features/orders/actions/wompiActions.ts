"use server"

import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"

/**
 * Genera la firma de integridad requerida por Wompi vinculada estrictamente al pedido en BD.
 * Valida que el pedido exista, pertenezca al usuario en sesión, esté en estado PENDING,
 * y calcula la firma criptográfica usando el monto REAL de la base de datos (evitando oráculos y manipulación de precios).
 *
 * Formato: SHA256(reference + amountInCents + currency + integritySecret)
 */
export async function getWompiIntegritySignature(
  reference: string,
  providedAmountInCents?: number,
  currency: string = "COP"
): Promise<string> {
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET

  if (!integritySecret || integritySecret.startsWith("test_integrity_REEMPLAZAR")) {
    console.warn("[Wompi] WOMPI_INTEGRITY_SECRET no configurado. La firma de integridad es requerida en producción.")
    return ""
  }

  // 1. Validar autenticación
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error("No autenticado")
  }

  // 2. Consultar orden real en la base de datos
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total_amount, user_id, status")
    .eq("id", reference)
    .single()

  if (orderError || !order) {
    throw new Error("Orden no encontrada")
  }

  // 3. Validar pertenencia y estado
  if (order.user_id !== user.id) {
    throw new Error("Acceso denegado a la orden")
  }

  if (order.status !== "PENDING") {
    throw new Error("Solo las órdenes pendientes pueden recibir firma de pago")
  }

  // 4. Calcular el monto en centavos a partir del total_amount real de la base de datos
  const realAmountInCents = Math.round(Number(order.total_amount) * 100)

  // 5. Validar que si el cliente envió un monto, este coincida con el real
  if (providedAmountInCents !== undefined && providedAmountInCents !== realAmountInCents) {
    console.warn(`[Wompi] Discrepancia de monto detectada para orden ${reference}: cliente=${providedAmountInCents}, bd=${realAmountInCents}`)
  }

  const stringToHash = `${order.id}${realAmountInCents}${currency}${integritySecret}`
  const hash = crypto.createHash("sha256").update(stringToHash).digest("hex")
  return hash
}
