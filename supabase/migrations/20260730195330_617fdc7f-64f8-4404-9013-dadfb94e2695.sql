ALTER TYPE public.location_role ADD VALUE IF NOT EXISTS 'admin';

CREATE OR REPLACE FUNCTION public.can_manage_location(_user_id uuid, _location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id
                   AND role::text IN ('owner', 'admin', 'manager'))
$$;

CREATE OR REPLACE FUNCTION public.can_admin_location(_user_id uuid, _location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id
                   AND role::text IN ('owner', 'admin'))
$$;

DROP POLICY IF EXISTS "Managers write settings" ON public.app_settings;
CREATE POLICY "Admins write settings" ON public.app_settings
FOR ALL TO authenticated
USING (location_id IS NOT NULL AND public.can_admin_location(auth.uid(), location_id))
WITH CHECK (location_id IS NOT NULL AND public.can_admin_location(auth.uid(), location_id));

CREATE OR REPLACE FUNCTION public.grant_admin_to_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role::text IN ('owner', 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT lm.user_id, 'admin'::app_role FROM public.location_members lm
WHERE lm.role::text IN ('owner', 'admin')
ON CONFLICT DO NOTHING;