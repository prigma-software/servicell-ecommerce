import { Resend } from "resend"
import { notificationsConfig } from "@/config/notifications.config"
import { whatsappService } from "@/shared/services/whatsapp.service"

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Prigma Comercio"
const siteUrl =
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

// -------------------------------------------------------
// Tipos
// -------------------------------------------------------
export type OrderEmailItem = {
  name: string
  quantity: number
  price_at_purchase: number
  sku_code?: string | null
}

export type OrderNotificationData = {
  orderId: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  shippingAddress: string
  totalAmount: number
  wompiTransactionId?: string | null
  items: OrderEmailItem[]
}

// Alias de compatibilidad hacia atrás
export type OrderEmailData = OrderNotificationData

// -------------------------------------------------------
// Formato de precio
// -------------------------------------------------------
function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount)
}

// -------------------------------------------------------
// Template HTML del email
// -------------------------------------------------------
function buildEmailHtml(data: OrderEmailData): string {
  const orderShortId = data.orderId.slice(0, 8).toUpperCase()

  const itemsRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <span style="font-weight:600;color:#1a1a1a;">${item.name}</span>
          ${item.sku_code ? `<br><span style="font-size:12px;color:#888;">${item.sku_code}</span>` : ""}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#555;">
          x${item.quantity}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#1a1a1a;">
          ${formatCOP(item.price_at_purchase * item.quantity)}
        </td>
      </tr>
    `
    )
    .join("")

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmación de pedido — ${siteName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

          <!-- Header -->
          <tr>
            <td style="background:#18181b;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                ${siteName}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-radius:0 0 12px 12px;">

              <!-- Icono de éxito -->
              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;width:60px;height:60px;background:#ecfdf5;border-radius:50%;line-height:60px;text-align:center;">
                  <span style="font-size:28px;">✓</span>
                </div>
              </div>

              <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a1a;text-align:center;">
                ¡Pago confirmado!
              </h2>
              <p style="margin:0 0 32px;color:#666;font-size:15px;text-align:center;line-height:1.6;">
                Hola <strong>${data.customerName}</strong>, recibimos tu pago correctamente.<br>
                Pronto procesaremos y enviaremos tu pedido.
              </p>

              <!-- Referencia del pedido -->
              <div style="background:#f8f8f8;border-radius:8px;padding:16px 20px;margin-bottom:32px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">
                      N° de Pedido
                    </td>
                    <td style="text-align:right;font-family:monospace;font-size:14px;color:#1a1a1a;font-weight:700;">
                      #${orderShortId}
                    </td>
                  </tr>
                  ${data.wompiTransactionId ? `
                  <tr>
                    <td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;padding-top:8px;">
                      ID Transacción Wompi
                    </td>
                    <td style="text-align:right;font-family:monospace;font-size:11px;color:#888;padding-top:8px;word-break:break-all;">
                      ${data.wompiTransactionId}
                    </td>
                  </tr>` : ""}
                </table>
              </div>

              <!-- Items del pedido -->
              <h3 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.5px;">
                Resumen del pedido
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                ${itemsRows}
                <tr>
                  <td colspan="3" style="padding-top:16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:16px;font-weight:700;color:#1a1a1a;">Total pagado</td>
                        <td style="text-align:right;font-size:18px;font-weight:800;color:#18181b;">
                          ${formatCOP(data.totalAmount)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Dirección de envío -->
              <div style="background:#f0fdf4;border:1px solid #d1fae5;border-radius:8px;padding:16px 20px;margin-bottom:32px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">
                  Dirección de envío
                </p>
                <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">
                  ${data.shippingAddress}
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${siteUrl}/profile/orders"
                   style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;">
                  Ver mis pedidos
                </a>
              </div>

              <hr style="border:none;border-top:1px solid #f0f0f0;margin:0 0 24px;">

              <p style="margin:0;font-size:13px;color:#aaa;text-align:center;line-height:1.6;">
                Si tienes dudas sobre tu pedido, responde este correo.<br>
                <a href="${siteUrl}" style="color:#18181b;text-decoration:none;font-weight:600;">${siteName}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

// -------------------------------------------------------
// Envíos Resend (Email)
// -------------------------------------------------------
async function sendOrderConfirmationResend(data: OrderNotificationData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || `noreply@${process.env.NEXT_PUBLIC_SITE_URL?.replace(/https?:\/\//, "") || "example.com"}`

  if (!apiKey || apiKey === "re_REEMPLAZAR_CON_API_KEY_DE_RESEND") {
    console.warn("[Email] RESEND_API_KEY no configurado. Email de confirmación no enviado.")
    return
  }

  const resend = new Resend(apiKey)
  const orderShortId = data.orderId.slice(0, 8).toUpperCase()

  try {
    const { error } = await resend.emails.send({
      from: `${siteName} <${fromEmail}>`,
      to: [data.customerEmail],
      subject: `✓ Pedido #${orderShortId} confirmado — ${siteName}`,
      html: buildEmailHtml(data),
    })

    if (error) {
      console.error("[Email] Error enviando confirmación de orden:", error)
    } else {
      console.log(`[Email] Confirmación enviada a ${data.customerEmail} para orden #${orderShortId}`)
    }
  } catch (err) {
    // No lanzar error — el pago ya se procesó, no queremos fallar el webhook por el email
    console.error("[Email] Error inesperado enviando email:", err)
  }
}

// -------------------------------------------------------
// Template HTML del email Manual
// -------------------------------------------------------
function buildManualEmailHtml(data: OrderEmailData): string {
  const orderShortId = data.orderId.slice(0, 8).toUpperCase()

  const itemsRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <span style="font-weight:600;color:#1a1a1a;">${item.name}</span>
          ${item.sku_code ? `<br><span style="font-size:12px;color:#888;">${item.sku_code}</span>` : ""}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#555;">
          x${item.quantity}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#1a1a1a;">
          ${formatCOP(item.price_at_purchase * item.quantity)}
        </td>
      </tr>
    `
    )
    .join("")

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pedido Recibido — ${siteName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
          <tr>
            <td style="background:#18181b;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                ${siteName}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-radius:0 0 12px 12px;">
              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;width:60px;height:60px;background:#fef3c7;border-radius:50%;line-height:60px;text-align:center;">
                  <span style="font-size:28px;color:#d97706;">🕒</span>
                </div>
              </div>
              <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a1a;text-align:center;">
                ¡Pedido recibido!
              </h2>
              <p style="margin:0 0 32px;color:#666;font-size:15px;text-align:center;line-height:1.6;">
                Hola <strong>${data.customerName}</strong>, hemos recibido tu pedido y hemos reservado tus productos.<br>
                Nos pondremos en contacto contigo pronto para coordinar el pago.
              </p>
              <div style="background:#f8f8f8;border-radius:8px;padding:16px 20px;margin-bottom:32px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">
                      N° de Pedido
                    </td>
                    <td style="text-align:right;font-family:monospace;font-size:14px;color:#1a1a1a;font-weight:700;">
                      #${orderShortId}
                    </td>
                  </tr>
                </table>
              </div>
              <h3 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.5px;">
                Resumen del pedido
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                ${itemsRows}
                <tr>
                  <td colspan="3" style="padding-top:16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:16px;font-weight:700;color:#1a1a1a;">Total a pagar</td>
                        <td style="text-align:right;font-size:18px;font-weight:800;color:#18181b;">
                          ${formatCOP(data.totalAmount)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div style="background:#f0fdf4;border:1px solid #d1fae5;border-radius:8px;padding:16px 20px;margin-bottom:32px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">
                  Dirección de envío
                </p>
                <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">
                  ${data.shippingAddress}
                </p>
              </div>
              <hr style="border:none;border-top:1px solid #f0f0f0;margin:0 0 24px;">
              <p style="margin:0;font-size:13px;color:#aaa;text-align:center;line-height:1.6;">
                Si tienes dudas sobre tu pedido, responde este correo.<br>
                <a href="${siteUrl}" style="color:#18181b;text-decoration:none;font-weight:600;">${siteName}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

async function sendManualOrderResend(data: OrderNotificationData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || `noreply@${(process.env.NEXT_PUBLIC_SITE_URL || "example.com").replace("https://", "").replace("http://", "")}`
  const adminEmail = process.env.ADMIN_EMAIL || fromEmail

  if (!apiKey || apiKey === "re_REEMPLAZAR_CON_API_KEY_DE_RESEND") {
    console.warn("[Email] RESEND_API_KEY no configurado. Email de orden manual no enviado.")
    return
  }

  const resend = new Resend(apiKey)
  const orderShortId = data.orderId.slice(0, 8).toUpperCase()

  try {
    const { error } = await resend.emails.send({
      from: `${siteName} <${fromEmail}>`,
      to: [data.customerEmail, adminEmail],
      subject: `🕒 Pedido #${orderShortId} recibido (Pendiente de pago) — ${siteName}`,
      html: buildManualEmailHtml(data),
    })

    if (error) {
      console.error("[Email] Error enviando email de orden manual:", error)
    } else {
      console.log(`[Email] Email de orden manual enviada a ${data.customerEmail} y ${adminEmail} para orden #${orderShortId}`)
    }
  } catch (err) {
    console.error("[Email] Error inesperado enviando email de orden manual:", err)
  }
}

// -------------------------------------------------------
// Envíos WhatsApp Cloud API
// -------------------------------------------------------
async function sendOrderConfirmationWhatsApp(data: OrderNotificationData): Promise<void> {
  if (!data.customerPhone) return

  const orderShortId = data.orderId.slice(0, 8).toUpperCase()
  const formattedTotal = formatCOP(data.totalAmount)
  const portalUrl = `${siteUrl}/orders`

  if (notificationsConfig.whatsapp.useTemplates) {
    // Parámetros estandarizados de la plantilla aprobada en Meta:
    // {{1}}: Nombre cliente, {{2}}: ID pedido, {{3}}: Total pagado, {{4}}: Enlace portal
    const params = [data.customerName, orderShortId, formattedTotal, portalUrl]
    await whatsappService.sendTemplate(
      data.customerPhone,
      notificationsConfig.whatsapp.templates.orderConfirmation,
      params
    )
  } else {
    // Modo desarrollo / sandbox con texto libre
    const itemsSummary = data.items
      .map((i) => `• ${i.name} x${i.quantity} (${formatCOP(i.price_at_purchase * i.quantity)})`)
      .join("\n")

    const text = [
      `🛍️ *¡Pedido Confirmado!* #${orderShortId}`,
      ``,
      `Hola *${data.customerName}*, tu compra ha sido confirmada con éxito.`,
      ``,
      `*Total pagado:* ${formattedTotal}`,
      `*Dirección de entrega:* ${data.shippingAddress}`,
      ``,
      `*Resumen de compra:*`,
      itemsSummary,
      ``,
      `Puedes consultar los detalles de tu compra en:`,
      portalUrl,
      ``,
      `¡Gracias por comprar en *${siteName}*!`,
    ].join("\n")

    await whatsappService.sendText(data.customerPhone, text)
  }
}

async function sendManualOrderWhatsApp(data: OrderNotificationData): Promise<void> {
  if (!data.customerPhone) return

  const orderShortId = data.orderId.slice(0, 8).toUpperCase()
  const formattedTotal = formatCOP(data.totalAmount)

  if (notificationsConfig.whatsapp.useTemplates) {
    // Parámetros estandarizados de la plantilla aprobada en Meta:
    // {{1}}: Nombre cliente, {{2}}: ID pedido, {{3}}: Total a pagar, {{4}}: URL tienda
    const params = [data.customerName, orderShortId, formattedTotal, siteUrl]
    await whatsappService.sendTemplate(
      data.customerPhone,
      notificationsConfig.whatsapp.templates.manualOrderPending,
      params
    )
  } else {
    // Modo desarrollo / sandbox con texto libre
    const itemsSummary = data.items
      .map((i) => `• ${i.name} x${i.quantity} (${formatCOP(i.price_at_purchase * i.quantity)})`)
      .join("\n")

    const text = [
      `🕒 *Pedido Recibido (Pendiente de Pago)* #${orderShortId}`,
      ``,
      `Hola *${data.customerName}*, hemos recibido tu pedido y hemos reservado tus productos.`,
      ``,
      `*Total a pagar:* ${formattedTotal}`,
      `*Dirección de entrega:* ${data.shippingAddress}`,
      ``,
      `*Resumen del pedido:*`,
      itemsSummary,
      ``,
      `Nos pondremos en contacto contigo pronto para coordinar el pago.`,
      ``,
      `*${siteName}*`,
    ].join("\n")

    await whatsappService.sendText(data.customerPhone, text)
  }
}

// -------------------------------------------------------
// Despachador Unificado y Multicanal
// -------------------------------------------------------
export async function sendOrderNotification(
  data: OrderNotificationData,
  type: "CONFIRMATION" | "MANUAL_PENDING"
): Promise<void> {
  const tasks: Promise<void>[] = []

  // Canal Email (Resend)
  if (notificationsConfig.channels.email && data.customerEmail) {
    tasks.push(
      type === "CONFIRMATION"
        ? sendOrderConfirmationResend(data)
        : sendManualOrderResend(data)
    )
  }

  // Canal WhatsApp (Meta Cloud API)
  if (notificationsConfig.channels.whatsapp && data.customerPhone) {
    tasks.push(
      type === "CONFIRMATION"
        ? sendOrderConfirmationWhatsApp(data)
        : sendManualOrderWhatsApp(data)
    )
  }

  if (tasks.length === 0) {
    return
  }

  // Ejecución concurrente aislada: ningún canal bloquea o tumba al otro
  await Promise.allSettled(tasks)
}

// -------------------------------------------------------
// Fachadas Públicas Retrocompatibles
// -------------------------------------------------------
export async function sendOrderConfirmationEmail(data: OrderNotificationData): Promise<void> {
  await sendOrderNotification(data, "CONFIRMATION")
}

export async function sendManualOrderCreatedEmail(data: OrderNotificationData): Promise<void> {
  await sendOrderNotification(data, "MANUAL_PENDING")
}
