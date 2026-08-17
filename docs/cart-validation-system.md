# Cart Validation & Stock Reservation System

Sistema implementado en 3 fases para proteger contra ventas de productos indisponibles y race conditions.

---

## Fases Implementadas

### Phase 1: Validación Core

**Objetivo**: Prevenir ventas de productos desactivados, variantes inactivas o sin stock.

**Reglas de negocio**:
1. Antes de agregar al carrito → validar producto activo
2. Antes de agregar → validar variante activa (si existe)
3. Antes de agregar → validar stock suficiente
4. Si pasa las 3 validaciones → item se agrega con snapshot del precio

**Estados de item en carrito**:
| Status | Descripción | Bloquea checkout? |
|--------|-------------|-------------------|
| `valid` | Todo bien | No |
| `product_inactive` | Producto desactivado por admin | Sí |
| `variant_inactive` | Variante desactivada | Sí |
| `out_of_stock` | Stock agotado | Sí |
| `price_changed` | Stock reducido o precio cambió | No |

**Validación en tiempo real**:
- Al abrir `/cart`
- Al abrir `/checkout`
- Al confirmar pago

---

### Phase 2: Auto-adjustment

**Objetivo**: Ajustar automáticamente cuando el stock cambió pero hay disponibilidad.

**Reglas de negocio**:
1. Si stock bajó pero hay > 0 → ajustar cantidad al máximo disponible automáticamente
2. Si precio cambió → mostrar banner con precio anterior y nuevo
3. `price_changed` NO bloquea checkout (solo notifica)

**Comportamiento**:
- Carrito muestra precio tachado + nuevo precio (rojo si aumentó, verde si bajó)
- Cantidad se auto-ajusta al stock disponible
- Banner en carrito: "Precios actualizados" con lista de cambios

---

### Phase 3: Stock Reservation

**Objetivo**: Evitar race conditions donde dos usuarios compran el último producto.

**Reglas de negocio**:
1. Al entrar a `/checkout` → se reserva stock por 15 minutos
2. Reserva decrementa stock real (disponible para otros baja)
3. Si pago APPROVED → confirmar reserva (stock ya decrementado)
4. Si pago DECLINED/ERROR → cancelar reserva (stock se restaura)
5. Si usuario abandona → stock se libera cuando expire o cuando alguien más entre a checkout

**Flag `has_active_reservation`**:
- Campo `BOOLEAN` en tabla `products`
- Cuando está `true`: al consultar stock se limpian reservas expiradas primero
- Se actualiza automáticamente en create/cancel/confirm/cleanup

**Flujo Wompi (Con Pasarela Online)**:
```
Usuario A entra a checkout
  → API /api/cart/reserve
  → Decrementa stock
  → Crea reserva con expires_at = now() + 15 min
  → Setea has_active_reservation = true

Usuario A paga APPROVED
  → API /api/cart/confirm
  → Marca reserva como confirmed
  → has_active_reservation = false

Usuario A abandona
  → Reserva expira en 15 min
  → Se libera con Lazy Cleanup al consultar o reservar stock
```

**Flujo Contra Entrega / Manual (Sin Pasarela)**:
```
Usuario entra a checkout con método 'manual'
  → No genera reserva temporal de 15 minutos en /api/cart/reserve
  → Al presionar "Confirmar Pedido Contra Entrega"
  → Invoca RPC 'create_manual_order_with_stock'
  → Valida stock disponible y descuenta inventario de forma atómica e inmediata
  → Crea la orden en estado 'PENDING_MANUAL' con 'is_paid = false'
  → Si la orden se cancela en el admin o expira por inactividad > 72h:
      → Invoca 'rollbackOrderStock' para restaurar las unidades en paralelo
      → Marca 'stock_returned = true' para evitar duplicación
```

---

## Endpoints Creados

### POST `/api/cart/validate`

Valida items del carrito contra la DB.

**Request**:
```json
{
  "items": [
    {
      "id": "variant_id o product_id",
      "product_id": "uuid",
      "variant_id": "uuid (opcional)",
      "quantity": 1,
      "price_snapshot": 49900
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "items": [
    {
      "id": "...",
      "product_id": "...",
      "status": "valid",
      "current_price": 49900,
      "current_stock": 5
    }
  ],
  "has_problems": false,
  "blocked_items": []
}
```

---

### POST `/api/cart/reserve`

Crea reserva de stock al entrar a checkout. También limpia reservas expiradas de todos los usuarios.

**Auth**: Requiere usuario logueado

**Request**:
```json
{
  "items": [
    {
      "product_id": "uuid",
      "variant_id": "uuid (opcional)",
      "quantity": 3
    }
  ]
}
```

**Response**:
```json
{
  "reservation_id": "uuid"
}
```

---

### POST `/api/cart/confirm`

Confirma reserva cuando pago es APPROVED.

**Auth**: Requiere usuario logueado

**Request**:
```json
{
  "reservation_id": "uuid"
}
```

**Response**:
```json
{
  "success": true
}
```

---

### POST `/api/cart/cancel`

Cancela reserva (timeout, abandono, pago declinado).

**Auth**: Requiere usuario logueado

**Request**:
```json
{
  "reservation_id": "uuid"
}
```

**Response**:
```json
{
  "success": true
}
```

---

### POST `/api/cron/cleanup-reservations` (Opcional)

Limpia reservas expiradas. Puede llamarse desde un cron job externo.

**No requiere auth** (proteger a nivel de infraestructura)

**Response**:
```json
{
  "success": true,
  "cleaned": 3,
  "message": "Cleaned up 3 expired reservations"
}
```

---

## Archivos Creados

### Tipos
- `lib/types/cart.ts` - CartItemValidationStatus, ValidatedCartItem, CartValidationResult

### Validación
- `lib/cart/cartValidator.ts` - validateCartItems(), cleanup on flag=true

### APIs
- `app/api/cart/validate/route.ts`
- `app/api/cart/reserve/route.ts`
- `app/api/cart/confirm/route.ts`
- `app/api/cart/cancel/route.ts`
- `app/api/cron/cleanup-reservations/route.ts`

### UI Actualizada
- `components/providers/CartProvider.tsx` - addItem async, revalidateCart, itemStatuses
- `components/product/AddToCartSimple.tsx` - manejo de errores
- `components/product/ProductVariantSelector.tsx` - manejo de errores
- `app/cart/page.tsx` - revalidación, badges, banners de precio
- `app/checkout/page.tsx` - reserva, confirmación, cancelación

### Migraciones SQL
- `supabase/migrations/05_stock_reservations.sql` - tablas + funciones base
- `supabase/migrations/06_add_reservation_flag.sql` - flag + cleanup por producto

---

## Notas de Implementación

1. **El flag `has_active_reservation`** evita hacer queries costosas para saber si hay reservas. Solo indica "hay algo pendiente, consultá con cuidado".

2. **El cleanup en validate** asegura que cuando el usuario intenta agregar al carrito, vea stock real aunque haya reservas expiradas sin limpiar.

3. **No se necesita cron job externo** para el caso del usuario que vuelve. El cleanup se hace automáticamente en reserve y validate.

4. **El cron externo** (`/api/cron/cleanup-reservations`) es útil si querés limpieza masiva periódica para casos edge donde nadie más entró a checkout.

5. **El webhook de Wompi** usa `createAdminClient()` para actualizar ordenes y decrementar stock al aprobar pagos.