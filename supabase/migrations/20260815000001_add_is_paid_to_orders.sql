-- supabase/migrations/20260815000001_add_is_paid_to_orders.sql

BEGIN;

-- 1. Agregar columna is_paid a la tabla orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

-- 2. Asegurar que las órdenes pagadas por Wompi queden marcadas como pagadas
UPDATE public.orders 
SET is_paid = true 
WHERE (payment_method = 'wompi' OR wompi_transaction_id IS NOT NULL) 
  AND status = 'APPROVED';

COMMIT;
