-- ============================================================
-- Security Hardening: Fix Profiles RLS Public Exposure
-- ============================================================
-- 1. Create SECURITY DEFINER function to check admin status
--    without triggering infinite recursion (Postgres error 42P17).
-- 2. Drop the overly permissive "Public profiles are viewable by everyone."
-- 3. Replace with "Profiles viewable by self or admin" restricting
--    SELECT to the owner user or active administrators.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'administrador'::public.user_role
  );
$$;

-- Drop old permissive policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by self or admin" ON public.profiles;

-- Create secure policy
CREATE POLICY "Profiles viewable by self or admin"
  ON public.profiles
  FOR SELECT
  USING (
    (auth.uid() = id) OR public.is_admin()
  );
