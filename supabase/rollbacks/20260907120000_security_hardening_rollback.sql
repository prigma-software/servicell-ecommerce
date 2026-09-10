-- ==============================================================================
-- SCRIPT DE ROLLBACK DE EMERGENCIA: FASE 1
-- Archivo: supabase/migrations/20260907120000_security_hardening_rollback.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ROLLBACK PROFILES PROTECTION & HANDLE_NEW_USER
-- ------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_role();

-- Restaurar handle_new_user a su versión original sin set_config
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
    RAISE LOG 'Error on profile creation trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;


-- ------------------------------------------------------------------------------
-- 2. ROLLBACK RPCS PERMISSIONS & RESTORE ORIGINAL FUNCTION
-- ------------------------------------------------------------------------------

GRANT ALL ON FUNCTION public.decrement_product_stock(uuid, integer) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.decrement_sku_stock(uuid, integer) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.decrement_pos_stock(jsonb) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.create_stock_reservation(uuid, jsonb, integer) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.confirm_stock_reservation(uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.cancel_stock_reservation(uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.cleanup_expired_reservations() TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.cleanup_expired_reservations_for_product(uuid) TO anon, authenticated, service_role;

GRANT ALL ON FUNCTION public.count_pos_sales_for_product(uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.count_pos_sales_for_variant(uuid) TO anon, authenticated, service_role;

-- Restaurar versión original de 20260724000000_add_order_stock_safeguards.sql
CREATE OR REPLACE FUNCTION public.create_manual_order_with_stock(
  p_order_data jsonb,
  p_items jsonb
) RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_updated_id uuid;
BEGIN
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
    shipping_zone_id
  ) VALUES (
    (p_order_data->>'user_id')::uuid,
    (p_order_data->>'total_amount')::int,
    (p_order_data->>'status')::public.order_status,
    (p_order_data->>'payment_method')::text,
    p_order_data->>'customer_name',
    p_order_data->>'customer_email',
    p_order_data->>'customer_phone',
    p_order_data->>'shipping_address',
    (p_order_data->>'shipping_cost')::int,
    (p_order_data->>'shipping_zone_id')::uuid
  ) RETURNING id INTO v_order_id;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT ALL ON FUNCTION public.create_manual_order_with_stock(jsonb, jsonb) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. ROLLBACK PRODUCT_IMAGES & PRODUCT_VARIANT_IMAGES POLICIES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "product_images_write" ON public.product_images;
DROP POLICY IF EXISTS "product_images_update" ON public.product_images;
DROP POLICY IF EXISTS "product_images_delete" ON public.product_images;

CREATE POLICY "product_images_write" ON public.product_images
  FOR INSERT WITH CHECK (auth.role() = ANY (ARRAY['authenticated'::text, 'service_role'::text]));

CREATE POLICY "product_images_update" ON public.product_images
  FOR UPDATE USING (auth.role() = ANY (ARRAY['authenticated'::text, 'service_role'::text]));

CREATE POLICY "product_images_delete" ON public.product_images
  FOR DELETE USING (auth.role() = ANY (ARRAY['authenticated'::text, 'service_role'::text]));

DROP POLICY IF EXISTS "product_variant_images_write" ON public.product_variant_images;
DROP POLICY IF EXISTS "product_variant_images_update" ON public.product_variant_images;
DROP POLICY IF EXISTS "product_variant_images_delete" ON public.product_variant_images;

CREATE POLICY "product_variant_images_write" ON public.product_variant_images
  FOR INSERT WITH CHECK (auth.role() = ANY (ARRAY['authenticated'::text, 'service_role'::text]));

CREATE POLICY "product_variant_images_update" ON public.product_variant_images
  FOR UPDATE USING (auth.role() = ANY (ARRAY['authenticated'::text, 'service_role'::text]));

CREATE POLICY "product_variant_images_delete" ON public.product_variant_images
  FOR DELETE USING (auth.role() = ANY (ARRAY['authenticated'::text, 'service_role'::text]));


-- ------------------------------------------------------------------------------
-- 4. ROLLBACK ORDERS INSERT POLICY
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can create their own orders." ON public.orders;

CREATE POLICY "Users can create their own orders." ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- 5. ROLLBACK WORK_ORDER_TEMPLATES & AUDIT_LOGS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can insert work order templates" ON public.work_order_templates;
DROP POLICY IF EXISTS "Admins can update work order templates" ON public.work_order_templates;
DROP POLICY IF EXISTS "Admins can delete work order templates" ON public.work_order_templates;

CREATE POLICY "Enable insert access for authenticated users" ON public.work_order_templates
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON public.work_order_templates
  AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins and service_role can insert audit logs" ON public.audit_logs;

CREATE POLICY "Authenticated users can insert audit logs." ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 6. ROLLBACK GET_WORK_ORDER_PUBLIC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_work_order_public(p_tracking_id TEXT, p_phone TEXT)
RETURNS SETOF public.work_orders
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.work_orders 
  WHERE tracking_id = p_tracking_id 
    AND customer_phone = p_phone;
$$;

GRANT EXECUTE ON FUNCTION public.get_work_order_public(TEXT, TEXT) TO anon, authenticated, service_role;

COMMIT;
