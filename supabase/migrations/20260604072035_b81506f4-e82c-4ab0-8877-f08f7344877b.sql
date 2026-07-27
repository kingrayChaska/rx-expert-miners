

DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated view roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.get_display_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND public.is_approved(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_display_names(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_display_names(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_display_names(uuid[]) TO authenticated;

