-- ==============================================================================
-- MIGRACIÓN DE SEGURIDAD FASE 1: ENDURECIMIENTO DE BASE DE DATOS Y MOTOR RLS
-- Archivo: supabase/migrations/20260907120000_security_hardening.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PROTECCIÓN DE ROLES EN PROFILES (INSERT Y UPDATE) + SOPORTE BOOTSTRAP
-- ------------------------------------------------------------------------------

-- 1.1 Actualizar handle_new_user() para emitir bandera transaccional local
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

  -- Bandera transaccional local: solo existe durante la transacción actual
  PERFORM set_config('app.bypass_role_protection', 'true', true);

  INSERT INTO public.profiles (id, email, role, first_name, last_name, phone, address)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'sin-correo@ecommerce.com'),
    CASE WHEN is_first_user THEN 'administrador'::public.user_role ELSE 'cliente'::public.user_role END,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'address'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error en trigger handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 1.2 Crear función protectora de roles para INSERT y UPDATE (Fail-Closed con neutralización de NULL)
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_trusted_caller BOOLEAN;
BEGIN
  -- Evaluar privilegios neutralizando valores NULL con COALESCE (Fail-Closed)
  v_is_trusted_caller := COALESCE(
    (
      COALESCE(current_setting('app.bypass_role_protection', true), 'false') = 'true'
      OR session_user IN ('postgres', 'supabase_admin')
      OR (COALESCE(auth.jwt()->>'role', '') = 'service_role')
      OR COALESCE(public.is_admin(), false)
    ),
    false
  );

  -- A. Validación en INSERT (Fail-Closed)
  IF TG_OP = 'INSERT' THEN
    IF v_is_trusted_caller IS NOT TRUE THEN
      NEW.role := 'cliente'::public.user_role;
    END IF;
    RETURN NEW;
  END IF;

  -- B. Validación en UPDATE (Fail-Closed)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF v_is_trusted_caller IS NOT TRUE THEN
        RAISE EXCEPTION 'Operación denegada: No tienes privilegios para modificar el rol de usuario.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();


-- ------------------------------------------------------------------------------
-- 2. REVOCACIÓN DE RPCS DE STOCK Y BLINDAJE DE ORDEN MANUAL
-- ------------------------------------------------------------------------------

-- 2.1 Revocar funciones de mutación directa de inventario a anon y authenticated
REVOKE EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.decrement_sku_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_sku_stock(uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.decrement_pos_stock(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_pos_stock(jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_stock_reservation(uuid, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_stock_reservation(uuid, jsonb, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_stock_reservation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_stock_reservation(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_stock_reservation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_stock_reservation(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reservations() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_reservations_for_product(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reservations_for_product(uuid) TO service_role;

-- 2.2 Endurecer y limitar count_pos_sales (solo authenticated y service_role, no anon)
REVOKE EXECUTE ON FUNCTION public.count_pos_sales_for_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_pos_sales_for_product(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.count_pos_sales_for_variant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_pos_sales_for_variant(uuid) TO authenticated, service_role;

-- 2.3 Endurecer create_manual_order_with_stock internamente y revocar anon
CREATE OR REPLACE FUNCTION public.create_manual_order_with_stock(
  p_order_data jsonb,
  p_items jsonb
) RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_updated_id uuid;
  v_target_user_id uuid;
BEGIN
  -- Validar identidad: El usuario debe ser el mismo de la sesión actual a menos que sea service_role o DBA
  v_target_user_id := (p_order_data->>'user_id')::uuid;
  IF (auth.jwt()->>'role' IS DISTINCT FROM 'service_role') 
     AND (session_user NOT IN ('postgres', 'supabase_admin')) THEN
    IF auth.uid() IS NULL OR v_target_user_id != auth.uid() THEN
      RAISE EXCEPTION 'Operación no autorizada: El user_id de la orden no coincide con la sesión activa.';
    END IF;
  END IF;

  -- Descontar stock item por item, todo-o-nada
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'variant_id') IS NOT NULL THEN
      UPDATE public.product_skus
      SET stock = stock - (v_item->>'quantity')::int
      WHERE id = (v_item->>'variant_id')::uuid
        AND stock >= (v_item->>'quantity')::int
      RETURNING id INTO v_updated_id;
    ELSE
      UPDATE public.products
      SET stock = stock - (v_item->>'quantity')::int
      WHERE id = (v_item->>'product_id')::uuid
        AND stock >= (v_item->>'quantity')::int
      RETURNING id INTO v_updated_id;
    END IF;

    IF v_updated_id IS NULL THEN
      RAISE EXCEPTION 'STOCK_AGOTADO: item %', coalesce(v_item->>'variant_id', v_item->>'product_id');
    END IF;
  END LOOP;

  -- Insertar la orden forzando estrictamente el estado PENDING_MANUAL e is_paid = false
  INSERT INTO public.orders (
    user_id,
    total_amount,
    status,
    payment_method,
    customer_name,
    customer_email,
    customer_phone,
    shipping_address,
    shipping_cost,
    shipping_zone_id,
    is_paid
  ) VALUES (
    v_target_user_id,
    (p_order_data->>'total_amount')::int,
    'PENDING_MANUAL'::public.order_status,
    'manual',
    p_order_data->>'customer_name',
    p_order_data->>'customer_email',
    p_order_data->>'customer_phone',
    p_order_data->>'shipping_address',
    (p_order_data->>'shipping_cost')::int,
    (p_order_data->>'shipping_zone_id')::uuid,
    false
  ) RETURNING id INTO v_order_id;

  -- Insertar los items de la orden
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      quantity,
      price_at_purchase
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'variant_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'price_at_purchase')::int
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.create_manual_order_with_stock(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_order_with_stock(jsonb, jsonb) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS RLS EN PRODUCT_IMAGES Y PRODUCT_VARIANT_IMAGES
-- ------------------------------------------------------------------------------

-- 3.1 product_images: solo lectura pública; escritura exclusiva admin/service_role
DROP POLICY IF EXISTS "product_images_write" ON public.product_images;
DROP POLICY IF EXISTS "product_images_update" ON public.product_images;
DROP POLICY IF EXISTS "product_images_delete" ON public.product_images;

CREATE POLICY "product_images_write" ON public.product_images
  FOR INSERT
  WITH CHECK (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'));

CREATE POLICY "product_images_update" ON public.product_images
  FOR UPDATE
  USING (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'))
  WITH CHECK (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'));

CREATE POLICY "product_images_delete" ON public.product_images
  FOR DELETE
  USING (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'));

-- 3.2 product_variant_images: solo lectura pública; escritura exclusiva admin/service_role
DROP POLICY IF EXISTS "product_variant_images_write" ON public.product_variant_images;
DROP POLICY IF EXISTS "product_variant_images_update" ON public.product_variant_images;
DROP POLICY IF EXISTS "product_variant_images_delete" ON public.product_variant_images;

CREATE POLICY "product_variant_images_write" ON public.product_variant_images
  FOR INSERT
  WITH CHECK (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'));

CREATE POLICY "product_variant_images_update" ON public.product_variant_images
  FOR UPDATE
  USING (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'))
  WITH CHECK (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'));

CREATE POLICY "product_variant_images_delete" ON public.product_variant_images
  FOR DELETE
  USING (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'));


-- ------------------------------------------------------------------------------
-- 4. BLINDAJE DE INSERCIÓN EN ORDERS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can create their own orders." ON public.orders;

CREATE POLICY "Users can create their own orders." ON public.orders
  FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id)
    AND (status IN ('PENDING'::public.order_status, 'PENDING_MANUAL'::public.order_status))
    AND (is_paid IS FALSE OR is_paid IS NULL)
  );


-- ------------------------------------------------------------------------------
-- 5. RESTRICCIÓN DE WORK_ORDER_TEMPLATES Y AUDIT_LOGS
-- ------------------------------------------------------------------------------

-- 5.1 work_order_templates
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.work_order_templates;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.work_order_templates;

CREATE POLICY "Admins can insert work order templates" ON public.work_order_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'));

CREATE POLICY "Admins can update work order templates" ON public.work_order_templates
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'))
  WITH CHECK (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'));

CREATE POLICY "Admins can delete work order templates" ON public.work_order_templates
  FOR DELETE TO authenticated
  USING (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'));

-- 5.2 audit_logs
DROP POLICY IF EXISTS "Authenticated users can insert audit logs." ON public.audit_logs;

CREATE POLICY "Admins and service_role can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (auth.jwt()->>'role' = 'service_role'));


-- ------------------------------------------------------------------------------
-- 6. SANITIZACIÓN DE DATOS SENSIBLES EN GET_WORK_ORDER_PUBLIC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_work_order_public(p_tracking_id TEXT, p_phone TEXT)
RETURNS SETOF public.work_orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    tracking_id,
    customer_name,
    customer_phone,
    status,
    estimated_cost,
    notes,
    created_at,
    updated_at,
    (custom_metadata - 'password' - 'contraseña' - 'pin' - 'clave') AS custom_metadata,
    customer_email,
    resolution_note
  FROM public.work_orders 
  WHERE tracking_id = p_tracking_id 
    AND customer_phone = p_phone;
$$;

GRANT EXECUTE ON FUNCTION public.get_work_order_public(TEXT, TEXT) TO anon, authenticated, service_role;

COMMIT;
