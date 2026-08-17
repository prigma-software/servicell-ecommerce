# Tareas de Implementación: Pago Manual Configurable por Zona de Envío

## Database
- [x] Create Supabase migration to add `manual_payment_allowed` (BOOLEAN DEFAULT false) to `shipping_zones` table.
- [x] Update `ShippingZone` type in `src/features/cart/types/cart.types.ts` to include `manual_payment_allowed?: boolean`.

## Backend API
- [x] Modify `createShippingZone` in `src/features/admin/actions/adminActions.ts` to extract `manual_payment_allowed` from `formData` and insert it into Supabase.
- [x] Modify `updateShippingZone` in `src/features/admin/actions/adminActions.ts` to extract `manual_payment_allowed` from `formData` and update it in Supabase.

## Frontend Admin
- [x] Add a checkbox in `src/features/admin/components/ShippingZoneForm.tsx` (labeled "Permitir Pago Contra Entrega").
- [x] Bind the checkbox `defaultChecked` to `editingZone?.manual_payment_allowed`.
- [x] (Optional) Add a badge/icon in `ShippingZoneCard.tsx` to indicate if manual payment is allowed for that zone.

## Frontend Checkout
- [x] Update `isManualAllowed` logic in `app/checkout/page.tsx` to read `selectedZone?.manual_payment_allowed ?? false`.
- [x] Update the manual payment error message in `app/checkout/page.tsx` to be dynamic ("El pago manual no está disponible para la zona de envío seleccionada.").
- [x] Update the manual payment description text in `app/checkout/page.tsx` to "Sujeto a disponibilidad por zona de envío".
