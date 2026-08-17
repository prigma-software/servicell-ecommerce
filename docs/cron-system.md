# Arquitectura de Mantenimiento y Limpieza (On-Demand / Lazy Cleanup)

## ⚠️ Restricción de Infraestructura: Supabase Free Tier (Sin `pg_cron`)
En el plan gratuito de Supabase no están disponibles las extensiones `pg_cron` ni `pg_net` para ejecutar tareas programadas automáticas dentro del motor PostgreSQL. Por lo tanto, **la aplicación NUNCA debe depender de cron jobs internos en la base de datos**.

Para garantizar la liberación de inventario y la expiración de órdenes sin `pg_cron`, la arquitectura implementa dos mecanismos complementarios:

---

## 1. Mecanismo Principal: Limpieza Bajo Demanda (*Event-Driven / Lazy Cleanup*)
La limpieza se ejecuta de forma pasiva cuando los usuarios interactúan con la plataforma:
- **Flag `has_active_reservation`:** La tabla `products` cuenta con este flag booleano. Se activa en `true` cuando se crea una reserva temporal de 15 minutos.
- **Validación al vuelo en `/api/cart/validate` y `/cart`:**
  - Cuando un cliente carga el carrito o entra al checkout, [`cartValidationService.ts`](file:///Users/christian/Documents/Empresa/E-commerce/E-commerce/src/features/cart/services/cartValidationService.ts) revisa si los productos tienen `has_active_reservation = true`.
  - Si es `true`, ejecuta inmediatamente la RPC `cleanup_expired_reservations_for_product` para restaurar el stock real antes de validar disponibilidad.
  - Adicionalmente, ejecuta `cleanupPendingOrders` para marcar como `ERROR` y retornar el inventario de órdenes `PENDING` (flujo Wompi) abandonadas por más de 30 minutos.

---

## 2. Mecanismo Secundario: Endpoint HTTP Maestro (`/api/cron/maintenance`)
Es un endpoint API HTTP (`POST /api/cron/maintenance`) diseñado para ser invocado externamente (por ejemplo desde Cloudflare Workers Cron Triggers, GitHub Actions o un servicio cron HTTP como Cron-Job.org).

### Tareas que ejecuta:
1. **Limpieza Global de Reservas y Órdenes Wompi (15-30 min):**
   - Ejecuta `cleanup_expired_reservations` para barrer todas las reservas huérfanas pendientes.
   - Detecta órdenes `PENDING` con más de 30 minutos sin respuesta de webhook, las marca en `ERROR` y restaura su inventario.
2. **Limpieza de Órdenes Manuales / Contra Entrega (> 72 horas):**
   - Detecta órdenes en estado `PENDING_MANUAL` con más de 72 horas de antigüedad sin aprobación de despacho.
   - Restaura el stock a los productos/variantes correspondientes.
   - Actualiza la orden a `DECLINED`, marcando `stock_returned = true`, `cancellation_reason = 'Expiración automática por inactividad > 72h'` y registrando el evento en `audit_logs`.
3. **Validación Periódica de Licencia PRIGMA:**
   - Verifica de manera asíncrona la vigencia de la licencia con el servidor de licencias PRIGMA para mantener la caché local al día.

### Invocación:
- **Método:** `POST`
- **Ruta:** `/api/cron/maintenance`
- **Respuesta:** JSON con desglose de reservas limpiadas, órdenes manuales procesadas y estado de licencia.

