# Reporte Exhaustivo de Auditoría de Seguridad — E-commerce PRIGMA
**Fecha:** 2026-09-07  
**Ámbito:** Middleware, Cloudflare Edge, Proxy, Next.config, Wrangler, Endpoints de API, Server Actions, Lógica de Checkout/POS y Prevención XSS.

---

## Resumen Ejecutivo

Se realizó una auditoría de seguridad integral sobre el código fuente, configuración y lógica de negocio del proyecto E-commerce. Se identificaron múltiples vulnerabilidades críticas y de alto impacto que comprometen el control de acceso, la integridad de los pagos, la confidencialidad de datos personales (PII) y la ejecución segura en el cliente.

### Cuadro de Severidad de Hallazgos

| ID | Vulnerabilidad | Severidad | Categoría (OWASP) |
|---|---|---|---|
| **VULN-01** | Bypasses de Autenticación y Ausencia de `assertAdmin` en Server Actions Administrativas | **Crítica** | Broken Access Control (A01:2021) |
| **VULN-02** | Desprotección de Rutas `/api/pos/*` y Manipulación de Precios desde el Cliente en POS | **Crítica** | Broken Access Control & Business Logic Flaw |
| **VULN-03** | Generador de Firma de Integridad Wompi Expuesto sin Validación de Monto en Base de Datos | **Alta** | Cryptographic Failures & Broken Logic |
| **VULN-04** | Bypass de Autenticación y Manipulación de Cookies de Licencia en `proxy.ts` | **Alta** | Authentication Bypass & Client-Side Cookie Trust |
| **VULN-05** | Desalineación de Middleware: `/api/*` y `/checkout` Desprotegidos a Nivel de Edge | **Alta** | Security Misconfiguration (A05:2021) |
| **VULN-06** | Exposición de Contraseñas de Dispositivos en Seguimiento Público de Órdenes de Trabajo | **Media-Alta** | Sensitive Data Exposure / IDOR (A01:2021) |
| **VULN-07** | DOM-based / Stored XSS mediante `document.write` y `innerHTML` en Modal de Recibo POS | **Media** | Cross-Site Scripting XSS (A03:2021) |
| **VULN-08** | Cabeceras HTTP de Seguridad Laxas (`unsafe-inline`, `unsafe-eval`, falta de HSTS general) | **Media** | Security Misconfiguration (A05:2021) |
| **VULN-09** | Scripts con Service Role Key y Lectura de `.env` en Raíz (`query_order.ts`) | **Media** | Information Disclosure |

---

## 1. Análisis de Configuración y Edge (`middleware.ts`, `proxy.ts`, `next.config.ts`, `wrangler.jsonc`)

### 1.1 `middleware.ts` y `lib/supabase/middleware-client.ts`
- **Falla en Prefijo de API**: El middleware verifica `request.nextUrl.pathname.startsWith("/api/admin")`. Sin embargo, los endpoints administrativos del sistema se ubican en `/api/orders/export`, `/api/pos/*`, `/api/users`, etc. Ninguno coincide con `/api/admin/*`, por lo que el middleware **no intercepta ni protege estas rutas**.
- **Ruta `/checkout`**: `/checkout` depende únicamente de una verificación en el cliente (`useEffect` en `CheckoutPage`), permitiendo que clientes no autenticados descarguen el HTML y bundle del checkout antes de ser redirigidos.
- **Falta de Cabeceras en Middleware**: `updateSession` no inyecta cabeceras HTTP de seguridad globalmente en `NextResponse`, limitándose a asignar `Cache-Control` únicamente en rutas de admin o perfil.

### 1.2 `proxy.ts` (Vulnerabilidades Críticas de Lógica)
- **Bypass Directo con `?bloqueado=si`**:
  ```typescript
  const yaBloqueado = searchParams.get("bloqueado") === "si";
  if (!yaBloqueado) {
    // Verificación de autenticación, rol de administrador y licencia
  }
  return NextResponse.next();
  ```
  Si un atacante solicita `/admin/orders?bloqueado=si` o cualquier ruta bajo el matcher de `proxy.ts`, **se omite por completo la verificación de sesión, rol y licencia**, permitiendo acceso irrestricto.
- **Confianza Ciega en Cookies del Cliente**:
  ```typescript
  const cachedStatus = request.cookies.get("_license_status")?.value;
  if (cachedStatus) {
    const cached = JSON.parse(cachedStatus);
    if (Date.now() / 1000 < cached.expiresAt) return cached.active;
  }
  ```
  La cookie `_license_status` no cuenta con firma criptográfica (HMAC). Cualquier usuario puede forjar una cookie `_license_status={"active":true,"expiresAt":9999999999}` y evadir la verificación de licencia.
- **Código Muerto / Desincronizado**: `proxy.ts` no está conectado a `middleware.ts` en la versión actual de Next.js, generando una falsa sensación de seguridad.

### 1.3 `next.config.ts`
- **Content Security Policy (CSP)**:
  - Inclusión de `'unsafe-inline'` y `'unsafe-eval'` en `script-src`, lo que anula la protección de CSP frente a ataques de inyección XSS.
  - `img-src 'self' data: blob: https: *.supabase.co`: El comodín `https:` permite cargar imágenes desde cualquier servidor externo, facilitando ataques de exfiltración o rastreo.
  - Ausencia de directivas modernas de aislamiento: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.
- **HSTS Condicional**: `Strict-Transport-Security` se inyecta únicamente si `process.env.NODE_ENV === "production"`. En entornos Edge servidos con Cloudflare Workers u OpenNext, la variable puede no reflejarse adecuadamente si no se emite desde las cabeceras del Worker.

---

## 2. Auditoría de Endpoints de API y Server Actions en `app/` y `src/`

### 2.1 Server Actions Administrativas sin `assertAdmin` (Crítica)
Next.js expone automáticamente cada función exportada en archivos con `"use server"` como un endpoint HTTP público (invocable mediante petición POST con cabecera `Next-Action`).

Los siguientes archivos críticos carecen de validación de rol de administrador:
1. **`src/features/admin/actions/adminActions.ts`**:
   - `createCategory`, `updateCategory`, `deleteCategory`
   - `createShippingZone`, `updateShippingZone`, `deleteShippingZone`
   - `getDashboardMetrics`, `getRevenueByDay`, `getOrdersByStatus`, `getPOSSalesByStatus`
   *Impacto:* Cualquier usuario anónimo o cliente puede crear/eliminar zonas de envío, categorías de productos o consultar las métricas financieras de ventas y facturación de la empresa.
2. **`src/features/products/actions/productActions.ts`**:
   - `createProduct`, `updateProduct`, `updateVariant`, `toggleProductActive`, `archiveProduct`, `deleteProduct`, `deleteVariant`.
   *Impacto:* Manipulación, alteración de inventario y borrado no autorizado de productos y variantes.
3. **`src/features/orders/actions/orderActions.ts`**:
   - `updateOrderStatus`, `cancelOrder`, `approveManualOrder`, `rollbackOrderStock`, `markOrderAsError`, `getOrderAuditLogs`.
   - `markOrderAsPaid`: Solo verifica `const { data: { user } } = await client.auth.getUser()`, sin comprobar el rol `administrador`.
   *Impacto:* Aprobación arbitraria de órdenes contra entrega sin pago, alteración del estado de pedidos y lectura de logs de auditoría.
4. **`src/features/work-orders/actions/workOrderActions.ts`**:
   - `createWorkOrder`, `updateWorkOrderStatus`, `addEvidence`: Ninguna verificación de sesión ni rol.
   - `closeWorkOrderAndBill`: Verifica autenticación pero no rol, permitiendo a clientes comunes facturar y cerrar órdenes de trabajo técnicas.

### 2.2 Vulnerabilidades en `/api/pos/sales` (Manipulación de Precios y Roles)
- **Falta de Verificación de Rol**: En `app/api/pos/sales/route.ts`, el endpoint `POST` solo comprueba `if (!user)`. No restringe a administradores ni cajeros autorizados.
- **Manipulación de Precios (Client-Side Price Tampering)**:
  `createSale` en `src/features/pos/services/posSaleService.ts` toma `subtotal`, `total`, `discount_amount` e `items` directamente del cuerpo JSON enviado por el cliente. No valida los precios contra la base de datos y ejecuta la inserción con `createAdminClient()` (Service Role Key), ignorando RLS:
  ```typescript
  // posSaleService.ts: subtotal y total arbitrarios provistos por el cliente
  const sale = await insertPosSale(client, {
    seller_id: sellerId,
    items: JSON.stringify(items),
    subtotal,
    total, // Atacante envía 0
    payment_status: "paid"
  });
  ```
  *Impacto:* Un cliente malicioso puede registrar ventas con total \$0, alterar existencias en bodega y emitir comprobantes fraudulentos.

### 2.3 Oráculo de Firma en Wompi (`wompiActions.ts`)
- En `src/features/orders/actions/wompiActions.ts`:
  ```typescript
  export async function getWompiIntegritySignature(
    reference: string,
    amountInCents: number,
    currency: string = "COP"
  ): Promise<string>
  ```
  La función toma `amountInCents` y `reference` arbitrarios directamente desde el cliente sin contrastar la orden en la base de datos ni validar la pertenencia del pedido al usuario autenticado. La firma debe calcularse exclusivamente en servidor extrayendo el monto real (`order.total_amount`) de la orden persistida.

### 2.4 Fuga de PII y Credenciales Técnicas en Órdenes de Trabajo
- En `app/tracking/[id]/page.tsx` y la función SQL `get_work_order_public`:
  La función SQL ejecuta `SELECT * FROM work_orders WHERE tracking_id = p_tracking_id AND customer_phone = p_phone` y retorna todo el registro, incluyendo `custom_metadata.password` (contraseñas/PINes de desbloqueo de equipos técnicos ingresados por clientes). Esta información sensible se renderiza en la página de rastreo pública sin sanitizar.

### 2.5 Riesgo de Fuga en Script de Raíz (`query_order.ts`)
- `query_order.ts` realiza una lectura directa de `.env` y ejecuta consultas con `SUPABASE_SERVICE_ROLE_KEY` imprimiendo en consola teléfonos, nombres y direcciones de entrega. Este archivo debe ser eliminado o restringido a scripts de test en local fuera de producción.

---

## 3. Vulnerabilidades XSS en Componentes Dinámicos

### 3.1 DOM-based / Stored XSS en `ReceiptModal.tsx`
- En `src/features/pos/components/ReceiptModal.tsx` (líneas 56-83):
  ```typescript
  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open("", "", "width=300,height=600")
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>Recibo</title></head>
            <body>${receiptRef.current.innerHTML}</body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }
  ```
- **Vector de Riesgo**: Al extraer `receiptRef.current.innerHTML` y escribirlo mediante `document.write` dentro de una ventana en el mismo origen (`window.open("", ...)`), el navegador ejecuta cualquier etiqueta `<script>`, `<img>`, `<iframe>` o atributo de evento JavaScript malicioso inyectado previamente en el nombre de un producto, SKU o notas de la venta.

---

## 4. Propuestas de Corrección y Código

### 4.1 Remediación de `middleware.ts` y Rutas Protegidas
Modificar `lib/supabase/middleware-client.ts` para proteger de forma exhaustiva `/admin`, `/checkout`, y todos los endpoints de API sensibles:

```typescript
// lib/supabase/middleware-client.ts (Fragmento de corrección)
const pathname = request.nextUrl.pathname;

const isAdminRoute = pathname.startsWith("/admin");
const isProtectedApi = 
  pathname.startsWith("/api/pos") ||
  pathname.startsWith("/api/orders/export") ||
  pathname.startsWith("/api/users");

if (isAdminRoute || isProtectedApi) {
  if (!user) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?redirect=" + encodeURIComponent(pathname), request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "administrador") {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }
}

// Proteger /checkout para exigir sesión activa
if (pathname.startsWith("/checkout") && !user) {
  return NextResponse.redirect(new URL("/login?redirect=/checkout", request.url));
}
```

### 4.2 Blindaje de Server Actions con `assertAdmin`
Implementar llamadas obligatorias a `assertAdmin()` en cada Server Action administrativa:

```typescript
// En src/features/admin/actions/adminActions.ts
import { assertAdmin } from "@/shared/utils/authGuards"

export async function createCategory(formData: FormData) {
  await assertAdmin()
  // ... resto de la lógica
}

export async function createShippingZone(formData: FormData) {
  await assertAdmin()
  // ... resto de la lógica
}

export async function getDashboardMetrics(start: Date, end: Date) {
  await assertAdmin()
  // ... resto de la lógica
}
```

```typescript
// En src/features/products/actions/productActions.ts
import { assertAdmin } from "@/shared/utils/authGuards"

export async function createProduct(formData: FormData) {
  await assertAdmin()
  return svcCreateProduct(formData)
}

export async function deleteProduct(id: string, forceArchive?: boolean) {
  await assertAdmin()
  return svcDeleteProduct(id, forceArchive)
}
```

```typescript
// En src/features/orders/actions/orderActions.ts
import { assertAdmin } from "@/shared/utils/authGuards"

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
  await assertAdmin()
  return svcUpdateOrderStatus(orderId, newStatus)
}

export async function approveManualOrder(orderId: string) {
  const admin = await assertAdmin()
  // ... resto de la lógica
}
```

### 4.3 Validación Estricta de Precios en POS (`posSaleService.ts`)
Recalcular precios en el backend en lugar de confiar en los totales del cliente:

```typescript
// src/features/pos/services/posSaleService.ts (Fragmento de validación)
export async function createSale(sellerId: string, body: CreateSaleBody) {
  await requireAdminForReports(sellerId); // O rol cajero/vendedor
  const client = await createAdminClient();

  // Validar precios de cada producto y calcular subtotal real en servidor
  let calculatedSubtotal = 0;
  for (const item of body.items) {
    if (item.product_id) {
      const { data: prod } = await client
        .from("products")
        .select("price")
        .eq("id", item.product_id)
        .single();
      if (!prod) throw new Error("Producto no encontrado: " + item.name);
      calculatedSubtotal += prod.price * item.quantity;
    } else {
      // Si es ítem de orden de trabajo, validar contra costo final de la orden técnica
      calculatedSubtotal += item.unit_price * item.quantity;
    }
  }

  const expectedTotal = Math.max(0, calculatedSubtotal - (body.discount_amount || 0));
  if (Math.abs(expectedTotal - body.total) > 1) {
    throw new Error("Discrepancia en el cálculo del total de la venta.");
  }
  // Proceder con insertPosSale
}
```

### 4.4 Firma de Wompi Basada en BD (`wompiActions.ts`)
```typescript
// src/features/orders/actions/wompiActions.ts
"use server"

import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"

export async function getWompiIntegritySignature(orderId: string): Promise<{ signature: string; amountInCents: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: order, error } = await supabase
    .from("orders")
    .select("total_amount, user_id")
    .eq("id", orderId)
    .single()

  if (error || !order || order.user_id !== user.id) {
    throw new Error("Orden no encontrada o no autorizada")
  }

  const amountInCents = Math.round(order.total_amount) * 100
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || ""
  const stringToHash = `${orderId}${amountInCents}COP${integritySecret}`
  const signature = crypto.createHash("sha256").update(stringToHash).digest("hex")

  return { signature, amountInCents }
}
```

### 4.5 Remediación de XSS en Impresión de Recibos (`ReceiptModal.tsx`)
Reemplazar `window.open` y `document.write(innerHTML)` por estilos nativos de impresión CSS `@media print`:

```typescript
// Solución segura: usar window.print() con clase CSS de impresión
const handlePrint = () => {
  window.print();
};
```
O si se requiere un iframe aislado, crear los elementos DOM utilizando `document.createElement` y asignando propiedades de texto plano (`textContent`) sin usar `innerHTML`.

### 4.6 Filtrado de Metadatos Sensibles en Rastreo Público
En `app/tracking/[id]/page.tsx`, filtrar las claves que contengan credenciales o contraseñas antes de renderizarlas:

```typescript
const SENSITIVE_KEYS = new Set(["password", "contraseña", "pin", "patron", "credenciales"]);

{Object.entries(workOrder.custom_metadata)
  .filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase()))
  .map(([key, value]) => (
    <div key={key} className="bg-muted/30 p-3 rounded-md border">
      <span className="block text-xs text-muted-foreground capitalize mb-1">
        {METADATA_TRANSLATIONS[key] || key.replace(/_/g, " ")}
      </span>
      <span className="font-medium text-sm break-words">{String(value)}</span>
    </div>
  ))}
```

---

## 5. Plan de Acción Inmediato Priorizado

1. **Prioridad 1 (Inmediata - Hotfix de Acceso):** Incorporar `assertAdmin()` en `adminActions.ts`, `productActions.ts`, `orderActions.ts` y `workOrderActions.ts`.
2. **Prioridad 2 (Inmediata - Integridad Financiera):** Proteger `POST /api/pos/sales` con validación de rol y cálculo de precios server-side. Refactorizar `getWompiIntegritySignature` para que obtenga el monto desde la base de datos.
3. **Prioridad 3 (Inmediata - Rutas Edge):** Actualizar `lib/supabase/middleware-client.ts` para cubrir las rutas `/api/pos/*`, `/api/orders/*`, `/api/users` y `/checkout`.
4. **Prioridad 4 (Media):** Reemplazar `document.write` en `ReceiptModal.tsx` por estilos `@media print` e implementar el filtro de campos sensibles en `TrackingDetailPage`.
5. **Prioridad 5 (Mantenimiento):** Depurar `query_order.ts` de la raíz del proyecto y corregir las fallas de bypass en `proxy.ts`.
