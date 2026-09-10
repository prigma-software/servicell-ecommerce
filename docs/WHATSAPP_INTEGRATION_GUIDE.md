# Guía Maestra de Integración: WhatsApp Cloud API & Resend (Marca Blanca)

Esta guía documenta exhaustivamente la arquitectura, configuración en Meta, plantillas aprobadas, código implementado y los pasos para replicar el sistema de notificaciones multicanal en cualquier tienda hija (`servicell-ecommerce`, `VitaminasPaTi-E-commerce`, etc.).

---

## 📌 1. Visión General y Arquitectura

El sistema opera bajo una arquitectura **multicanal, desacoplada y configurable**, donde los eventos de negocio disparan notificaciones que se envían por **Correo Electrónico (Resend)**, por **WhatsApp (Meta Cloud API)** o por **ambos simultáneamente**, controlado por interruptores (`flags`) booleanos.

```
                                [Evento de Negocio]
                     (Compra aprobada / Orden de taller)
                                      │
                                      ▼
                        [Despachador Multicanal]
                 (sendOrderNotification / WorkOrderNotifier)
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
    [Canal Email - Resend]                        [Canal WhatsApp Cloud API]
 (Si channels.email = true)                     (Si channels.whatsapp = true)
              │                                               │
              ▼                                               ▼
      Resend API (HTML)                              Meta Graph API (E.164)
                                                 ┌────────────┴────────────┐
                                                 ▼                         ▼
                                           [Producción]              [Desarrollo]
                                        Plantillas Meta            Texto libre
                                        (order_confirmation,      (Sandbox dev con
                                         work_order_created)       emojis y enlaces)
```

### Eventos Soportados en el Ecosistema
1. **Tienda Online (`orders`)**:
   * **Compra Confirmada / Pagada**: Notifica al cliente cuando Wompi aprueba el pago o cuando un administrador aprueba el pedido manualmente.
   * **Pedido Manual Recibido**: Notifica al cliente (y copia al admin) cuando se realiza un pedido contra entrega o por transferencia bancaria.
2. **Servicio Técnico / Taller (`work-orders`)**:
   * **Nueva Orden Recibida**: Notifica al cliente la recepción de su equipo con su costo estimado y enlace único de rastreo en tiempo real (`/tracking?id=...`).
   * **Actualización de Estado**: Notifica cada avance (Borrador, Recibido, En Progreso / Revisión, En Pausa, Completado, Entregado, Cancelado) con el portal de seguimiento.

---

## 🔗 2. Enlaces Directos en Meta Business Suite

Para configurar y gestionar WhatsApp Cloud API en tu cuenta de Meta:

| Recurso | Enlace Directo | Propósito |
| :--- | :--- | :--- |
| **Administrador de Plantillas** | [Plantillas de WhatsApp](https://business.facebook.com/wa/manage/message-templates/?waba_id=1083721354172132) | Crear, consultar y editar plantillas oficiales de mensaje. |
| **Administrador de Números** | [Números de Teléfono](https://business.facebook.com/wa/manage/phone-numbers/?waba_id=1083721354172132) | Ver IDs de teléfono (`Phone Number ID`), agregar números reales y verificar líneas. |
| **Usuarios del Sistema** | [Configuración del Negocio > Usuarios](https://business.facebook.com/latest/settings) | Crear tokens permanentes de sistema que nunca expiran. |
| **Panel de Desarrolladores** | [Meta App Dashboard](https://developers.facebook.com/apps/1431913485666694/whatsapp-business/wa-dev-console/) | Configuración técnica de la API, webhooks y números de prueba sandbox. |

---

## 📄 3. Especificación de Plantillas Oficiales Aprobadas en Meta

Todas las plantillas están registradas y **APROBADAS** en Meta bajo las siguientes características obligatorias:
* **Categoría:** `Utilidad` (*Utility*).
* **Idioma:** `Spanish (COL)` $\rightarrow$ código de API: **`es_CO`**.
* **Regla de Meta:** Las variables `{{N}}` **no pueden estar al final de la plantilla**, por lo que siempre incluyen texto de cierre después de `{{4}}`.

### 1️⃣ `order_confirmation` (Confirmación de Compra Tienda)
* **Categoría:** Utilidad (*Utility*)
* **Idioma:** `Spanish (COL)` (`es_CO`)
* **Texto exacto:**
  ```text
  Hola {{1}}, tu pedido #{{2}} por valor de {{3}} ha sido confirmado con éxito. Puedes consultar los detalles y seguimiento aquí: {{4}}

  ¡Gracias por tu compra!
  ```
* **Variables mapeadas por el código:**
  * `{{1}}`: Nombre del cliente (`customerName`).
  * `{{2}}`: ID corto del pedido (`orderShortId`).
  * `{{3}}`: Total pagado en COP (`formattedTotal`, ej: `$180.000 COP`).
  * `{{4}}`: URL del portal (`https://.../orders`).

### 2️⃣ `manual_order_pending` (Pedido Manual / Contra Entrega)
* **Categoría:** Utilidad (*Utility*)
* **Idioma:** `Spanish (COL)` (`es_CO`)
* **Texto exacto:**
  ```text
  Hola {{1}}, hemos recibido tu pedido #{{2}} por valor de {{3}} y reservamos tus productos. Nos pondremos en contacto contigo para coordinar el pago. Más información aquí: {{4}}

  ¡Gracias por elegirnos!
  ```
* **Variables mapeadas por el código:**
  * `{{1}}`: Nombre del cliente (`customerName`).
  * `{{2}}`: ID corto del pedido (`orderShortId`).
  * `{{3}}`: Total a pagar en COP (`formattedTotal`).
  * `{{4}}`: URL de la tienda (`siteUrl`).

### 3️⃣ `work_order_created` (Orden de Servicio Técnico Creada)
* **Categoría:** Utilidad (*Utility*)
* **Idioma:** `Spanish (COL)` (`es_CO`)
* **Texto exacto:**
  ```text
  Hola {{1}}, hemos creado la orden de servicio #{{2}} para tu equipo. Costo estimado: {{3}}. Puedes hacer seguimiento y ver fotos en tiempo real aquí: {{4}}

  ¡Gracias por confiar en nosotros!
  ```
* **Variables mapeadas por el código:**
  * `{{1}}`: Nombre del cliente (`order.customer_name`).
  * `{{2}}`: ID de seguimiento (`order.tracking_id`).
  * `{{3}}`: Costo estimado (`$120.000 COP` o `Por cotizar`).
  * `{{4}}`: Enlace directo de tracking (`https://.../tracking?id=TK-1234`).

### 4️⃣ `work_order_status_update` (Cambio de Estado en Taller)
* **Categoría:** Utilidad (*Utility*)
* **Idioma:** `Spanish (COL)` (`es_CO`)
* **Texto exacto:**
  ```text
  Hola {{1}}, tu orden de servicio #{{2}} ha cambiado al estado: {{3}}. Para revisar los detalles, diagnóstico y fotos del avance ingresa aquí: {{4}}

  Cualquier duda, estamos a tu disposición.
  ```
* **Variables mapeadas por el código:**
  * `{{1}}`: Nombre del cliente (`order.customer_name`).
  * `{{2}}`: ID de seguimiento (`order.tracking_id`).
  * `{{3}}`: Estado en español (`statusEs`, ej: "En Progreso", "Completado").
  * `{{4}}`: Enlace directo de tracking (`https://.../tracking?id=TK-1234`).

---

## 🛠️ 4. Código Fuente Creado y Modificado

### A. Capa de Configuración y Utilidades
1. **Configuración Central:** [`src/config/notifications.config.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/config/notifications.config.ts)
   * Controla los interruptores de canal (`email`, `whatsapp`), código de país (`57`), idioma (`es_CO`), `useTemplates` y nombres de plantillas.
2. **Normalización E.164 y Enmascaramiento PII:** [`src/shared/utils/phone.utils.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/shared/utils/phone.utils.ts)
   * `formatWhatsAppPhone`: Limpia caracteres, remueve prefijos móviles legacy `03` y normaliza números colombianos e internacionales a formato E.164 sin `+` (`573001234567`).
   * `maskPhoneForLogs`: Enmascara PII para logs (`57300****567`).
3. **Cliente WhatsApp Cloud API Resiliente:** [`src/shared/services/whatsapp.service.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/shared/services/whatsapp.service.ts)
   * `sendTemplate`: Envía plantillas oficiales aprobadas.
   * `sendText`: Envía texto libre enriquecido para desarrollo local.
   * Cuenta con timeout estricto de 4.5 segundos (`AbortController`) y logs estructurados con `wamid` y códigos de Meta API sin lanzar excepciones que comprometan el flujo principal.

### B. Módulo de Pedidos (`src/features/orders`)
1. **Despachador:** [`src/features/orders/services/orderConfirmation.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/features/orders/services/orderConfirmation.ts)
   * `sendOrderNotification`: Orquesta envíos concurrentes con `Promise.allSettled`.
   * Preserva `sendOrderConfirmationEmail` y `sendManualOrderCreatedEmail` como fachadas retrocompatibles.
2. **Repositorio:** [`src/features/orders/repositories/orderRepository.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/features/orders/repositories/orderRepository.ts)
   * Añadido `customer_phone` a la consulta de `findOrderWithItemsForEmail`.
3. **Webhook Wompi:** [`src/features/orders/services/wompiWebhookService.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/features/orders/services/wompiWebhookService.ts)
   * Guardia flexible `if (order && (order.customer_email || order.customer_phone))`.
4. **Server Actions:** [`checkoutActions.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/features/orders/actions/checkoutActions.ts) y [`orderActions.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/features/orders/actions/orderActions.ts)
   * Pasan `customerPhone` y aplican `await` seguro para evitar terminación prematura en runtimes serverless.

### C. Módulo de Servicio Técnico (`src/features/work-orders`)
1. **Contrato Neutral:** [`src/features/work-orders/types/notification.types.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/features/work-orders/types/notification.types.ts)
   * `IWorkOrderNotificationPayload` y `IWorkOrderNotificationChannel`.
2. **Adaptador Resend:** [`src/features/work-orders/services/resend-notification.adapter.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/features/work-orders/services/resend-notification.adapter.ts)
   * Construye su propio HTML e ignora limpiamente órdenes sin email.
3. **Adaptador WhatsApp:** [`src/features/work-orders/services/whatsapp-notification.adapter.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/features/work-orders/services/whatsapp-notification.adapter.ts)
   * Mapea estados a plantillas o texto libre e ignora órdenes sin teléfono.
4. **Orquestador:** [`src/features/work-orders/services/work-order-notifier.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/features/work-orders/services/work-order-notifier.ts)
   * Inyección de dependencias (`channels?: IWorkOrderNotificationChannel[]`) y despacho concurrente.
5. **Acciones:** [`src/features/work-orders/actions/workOrderActions.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/features/work-orders/actions/workOrderActions.ts)
   * Instanciación desacoplada `new WorkOrderNotifier()`.

---

## ⚙️ 5. Diccionario de Variables de Entorno (`.env`)

Agrega estas variables al archivo `.env` o `.env.local` de tu proyecto:

```bash
# Canales de Notificación (Interruptores Globales)
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_WHATSAPP_NOTIFICATIONS=true

# Resend (Email)
RESEND_API_KEY=re_tu_api_key_de_resend
RESEND_FROM_EMAIL="PRIGMA <contacto@prigma.net>"
ADMIN_EMAIL=contacto@prigma.net
NEXT_PUBLIC_APP_URL=https://e-commerce.prigma.net

# WhatsApp Cloud API (Meta)
# Modo de ambiente: "test" (Sandbox) o "production" (Línea oficial)
WHATSAPP_ENV=test

# Número de Pruebas Sandbox (+1 555-659-3589)
WHATSAPP_PHONE_NUMBER_ID_TEST=1245197405353605

# Número Oficial en Producción (+57 311 2078781 - Prigma)
WHATSAPP_PHONE_NUMBER_ID_PROD=1097831320088489

# ID activo (opcional si usas WHATSAPP_ENV; si se define, actúa como fallback)
WHATSAPP_PHONE_NUMBER_ID=1245197405353605

# Token permanente de Usuario del Sistema (Meta)
WHATSAPP_ACCESS_TOKEN=EAA...tu_token_permanente_aqui...
WHATSAPP_API_VERSION=v22.0
WHATSAPP_USE_TEMPLATES=true
WHATSAPP_TEMPLATE_LANGUAGE=es_CO
WHATSAPP_DEFAULT_COUNTRY_CODE=57

# Nombres de Plantillas en Meta (Opcionales, toman estos valores por defecto)
WHATSAPP_TEMPLATE_ORDER_CONFIRMATION=order_confirmation
WHATSAPP_TEMPLATE_MANUAL_ORDER=manual_order_pending
WHATSAPP_TEMPLATE_WORK_ORDER_CREATED=work_order_created
WHATSAPP_TEMPLATE_WORK_ORDER_STATUS=work_order_status_update
```

> [!TIP]
> **Cambio instantáneo entre Pruebas y Producción:**
> Solo necesitas cambiar `WHATSAPP_ENV=test` a `WHATSAPP_ENV=production`. El sistema y el servicio `WhatsAppService` conmutan automáticamente entre `WHATSAPP_PHONE_NUMBER_ID_TEST` y `WHATSAPP_PHONE_NUMBER_ID_PROD`.

---

## 🚀 6. Cómo Replicar en Tiendas Hijas (`servicell-ecommerce`, `VitaminasPaTi-E-commerce`)

Gracias a la arquitectura Marca Blanca, para replicar todo lo construido en cualquier proyecto hijo solo sigues estos pasos:

### Paso 1: Traer las actualizaciones desde Marca Blanca
Desde la carpeta del proyecto hijo (`servicell-ecommerce` o `VitaminasPaTi-E-commerce`):

```bash
# 1. Asegurarse de tener el remoto 'upstream' apuntando a Marca Blanca
git remote -v

# Si no existe upstream, agregarlo:
# git remote add upstream https://github.com/0LAYUS/E-commerce.git

# 2. Descargar y fusionar los commits de Marca Blanca
git fetch upstream
git merge upstream/master --no-edit
```

### Paso 2: Configurar las variables en el `.env` del hijo
Abre el archivo `.env` de la tienda hija y añade:
1. `ENABLE_WHATSAPP_NOTIFICATIONS=true`
2. `WHATSAPP_PHONE_NUMBER_ID` (el ID del número que usará esa tienda).
3. `WHATSAPP_ACCESS_TOKEN` (el token de Meta).
4. `WHATSAPP_USE_TEMPLATES=true`.
5. `WHATSAPP_TEMPLATE_LANGUAGE=es_CO`.

### Paso 3: Verificar que los tests pasen
Ejecuta los tests unitarios en el hijo:
```bash
npm run test:run
```
Verás los 114 tests pasando limpiamente.

---

## 🧪 7. Pruebas y Comandos Útiles

### Probar el envío manual por CLI
Puedes lanzar un mensaje de prueba en cualquier momento con el script incluido, eligiendo si quieres que salga desde el Sandbox o desde la línea oficial:

```bash
# Envía desde el ambiente activo en tu .env (WHATSAPP_ENV):
node scripts/test-whatsapp.mjs 3178079672

# Forzar envío desde Sandbox de pruebas (+1 555...):
node scripts/test-whatsapp.mjs 3178079672 --env=test

# Forzar envío desde Línea oficial en producción (+57 311... Prigma):
node scripts/test-whatsapp.mjs 3178079672 --env=prod
```

### Probar envío de plantilla aprobada con Node:
```bash
node -e '
import fs from "fs";
const env = fs.readFileSync(".env", "utf-8");
const token = env.match(/WHATSAPP_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
const phoneId = env.match(/WHATSAPP_PHONE_NUMBER_ID=(.*)/)?.[1]?.trim();

const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    messaging_product: "whatsapp",
    to: "573178079672",
    type: "template",
    template: {
      name: "order_confirmation",
      language: { code: "es_CO" },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: "Cliente Prueba" },
          { type: "text", text: "ORD-0001" },
          { type: "text", text: "$100.000 COP" },
          { type: "text", text: "https://e-commerce.prigma.net/orders" }
        ]
      }]
    }
  })
});
console.log(await res.json());
'
```

---

## ❓ 8. Guía de Solución de Problemas (Troubleshooting)

| Error / Síntoma | Causa | Solución |
| :--- | :--- | :--- |
| **Error `131047: Re-engagement message`** | Intentaste enviar texto plano (`type: "text"`) a un cliente que no ha escrito en las últimas 24 horas. | Activa `WHATSAPP_USE_TEMPLATES=true` en `.env` para usar plantillas oficiales. |
| **Error `132001: Template does not exist`** | El código de idioma no coincide con el de Meta (ej. se envía `es` pero la plantilla se creó en `es_CO`). | Asegúrate de tener `WHATSAPP_TEMPLATE_LANGUAGE=es_CO` en `.env`. |
| **Error `132000: Parameter count mismatch`** | La cantidad de variables enviadas en el array no coincide con las llaves `{{N}}` del template. | El código ya tiene exactamente 4 parámetros para cada plantilla. |
| **Error `190: OAuthException (Session expired)`** | El token temporal de Meta expiró (dura 24 horas). | Genera un token permanente en **Usuarios del Sistema** con caducidad "Nunca". |
| **El mensaje aparece como aceptado pero no llega al celular** | Estás usando el número de prueba de Sandbox y el destinatario no está agregado en la lista blanca de prueba de Meta. | Agrega el número en Meta Developers > WhatsApp > API Setup > Destinatario, o usa un número real de producción. |
