-- 1) Establishment profile fields
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS establishment_type text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS setup_steps jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Pay period settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS pay_period_type text NOT NULL DEFAULT 'biweekly',
  ADD COLUMN IF NOT EXISTS pay_period_anchor date;

ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_pay_period_type_check;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_pay_period_type_check
  CHECK (pay_period_type IN ('weekly','biweekly','semimonthly','monthly'));

-- 3) One settings row per location
CREATE SEQUENCE IF NOT EXISTS public.app_settings_id_seq OWNED BY public.app_settings.id;
SELECT setval('public.app_settings_id_seq', GREATEST((SELECT COALESCE(MAX(id),0) FROM public.app_settings), 1));
ALTER TABLE public.app_settings ALTER COLUMN id SET DEFAULT nextval('public.app_settings_id_seq');

UPDATE public.app_settings s
SET location_id = (SELECT id FROM public.locations ORDER BY created_at LIMIT 1)
WHERE s.location_id IS NULL
  AND EXISTS (SELECT 1 FROM public.locations);

DELETE FROM public.app_settings WHERE location_id IS NULL;

DELETE FROM public.app_settings a
USING public.app_settings b
WHERE a.location_id = b.location_id AND a.id > b.id;

ALTER TABLE public.app_settings ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_location_id_key;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_location_id_key UNIQUE (location_id);

INSERT INTO public.app_settings (location_id, establishment_name)
SELECT l.id, l.name
FROM public.locations l
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings s WHERE s.location_id = l.id);

-- 4) Auto-create settings when a location is created
CREATE OR REPLACE FUNCTION public.create_default_app_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_settings (location_id, establishment_name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (location_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS locations_create_default_settings ON public.locations;
CREATE TRIGGER locations_create_default_settings
AFTER INSERT ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.create_default_app_settings();

-- 5) Team invitations
CREATE TABLE IF NOT EXISTS public.location_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.location_role NOT NULL DEFAULT 'manager',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS location_invites_pending_email_idx
  ON public.location_invites (location_id, lower(email))
  WHERE accepted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_invites TO authenticated;
GRANT ALL ON public.location_invites TO service_role;

ALTER TABLE public.location_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage invites for their location" ON public.location_invites;
CREATE POLICY "Managers manage invites for their location"
ON public.location_invites FOR ALL TO authenticated
USING (public.can_manage_location(auth.uid(), location_id))
WITH CHECK (public.can_manage_location(auth.uid(), location_id));

DROP POLICY IF EXISTS "Invitees can read their own invite" ON public.location_invites;
CREATE POLICY "Invitees can read their own invite"
ON public.location_invites FOR SELECT TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS location_invites_updated_at ON public.location_invites;
CREATE TRIGGER location_invites_updated_at
BEFORE UPDATE ON public.location_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.accept_location_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.location_invites%ROWTYPE;
  uid uuid := auth.uid();
  uemail text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  SELECT * INTO inv FROM public.location_invites
  WHERE token = _token AND accepted_at IS NULL AND expires_at > now();

  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation is invalid or has expired'; END IF;
  IF lower(inv.email) <> uemail THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  INSERT INTO public.location_members (user_id, location_id, role)
  VALUES (uid, inv.location_id, inv.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.location_invites SET accepted_at = now() WHERE id = inv.id;
  RETURN inv.location_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_location_invite(text) TO authenticated;

-- 6) Logo storage access rules (bucket created separately)
DROP POLICY IF EXISTS "Logos are publicly readable" ON storage.objects;
CREATE POLICY "Logos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Managers upload their location logo" ON storage.objects;
CREATE POLICY "Managers upload their location logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND public.can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Managers update their location logo" ON storage.objects;
CREATE POLICY "Managers update their location logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND public.can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Managers delete their location logo" ON storage.objects;
CREATE POLICY "Managers delete their location logo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'logos'
  AND public.can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)
);