
-- =========================================================
-- 1. ENUMS
-- =========================================================
CREATE TYPE public.location_role AS ENUM ('owner', 'manager', 'staff');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');

-- =========================================================
-- 2. PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- =========================================================
-- 3. LOCATIONS
-- =========================================================
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT,
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER locations_updated_at BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 4. LOCATION MEMBERS
-- =========================================================
CREATE TABLE public.location_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.location_role NOT NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_members TO authenticated;
GRANT ALL ON public.location_members TO service_role;
ALTER TABLE public.location_members ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 5. SECURITY DEFINER HELPERS (avoid RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_location_member(_user_id UUID, _location_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id)
$$;

CREATE OR REPLACE FUNCTION public.has_location_role(_user_id UUID, _location_id UUID, _role public.location_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id AND role = _role)
$$;

-- Owner OR manager
CREATE OR REPLACE FUNCTION public.can_manage_location(_user_id UUID, _location_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id
                   AND role IN ('owner', 'manager'))
$$;

-- =========================================================
-- 6. LOCATIONS / MEMBERS POLICIES
-- =========================================================
CREATE POLICY "Members view their locations" ON public.locations
  FOR SELECT TO authenticated
  USING (public.is_location_member(auth.uid(), id));
CREATE POLICY "Owners update their location" ON public.locations
  FOR UPDATE TO authenticated
  USING (public.has_location_role(auth.uid(), id, 'owner'))
  WITH CHECK (public.has_location_role(auth.uid(), id, 'owner'));
CREATE POLICY "Authenticated users create locations" ON public.locations
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Members view membership of their locations" ON public.location_members
  FOR SELECT TO authenticated
  USING (public.is_location_member(auth.uid(), location_id));
CREATE POLICY "Owners manage members" ON public.location_members
  FOR ALL TO authenticated
  USING (public.has_location_role(auth.uid(), location_id, 'owner'))
  WITH CHECK (public.has_location_role(auth.uid(), location_id, 'owner'));

-- =========================================================
-- 7. ADD location_id TO EXISTING TABLES (nullable for backfill)
-- =========================================================
ALTER TABLE public.app_settings ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE;
ALTER TABLE public.staff        ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE;
ALTER TABLE public.shifts       ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE;

-- =========================================================
-- 8. BACKFILL: create Default Location owned by first admin (if any)
-- =========================================================
DO $$
DECLARE
  v_owner UUID;
  v_loc UUID;
BEGIN
  SELECT user_id INTO v_owner FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF v_owner IS NULL THEN
    SELECT id INTO v_owner FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;

  IF v_owner IS NOT NULL THEN
    INSERT INTO public.locations (name, owner_user_id, status, trial_ends_at)
    VALUES ('Default Location', v_owner, 'active', NULL)
    RETURNING id INTO v_loc;

    INSERT INTO public.location_members (location_id, user_id, role)
    VALUES (v_loc, v_owner, 'owner');

    UPDATE public.app_settings SET location_id = v_loc WHERE location_id IS NULL;
    UPDATE public.staff        SET location_id = v_loc WHERE location_id IS NULL;
    UPDATE public.shifts       SET location_id = v_loc WHERE location_id IS NULL;
  END IF;
END $$;

-- Make NOT NULL only if backfill succeeded for all rows
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE location_id IS NULL)
     AND NOT EXISTS (SELECT 1 FROM public.shifts WHERE location_id IS NULL)
     AND NOT EXISTS (SELECT 1 FROM public.app_settings WHERE location_id IS NULL) THEN
    ALTER TABLE public.staff  ALTER COLUMN location_id SET NOT NULL;
    ALTER TABLE public.shifts ALTER COLUMN location_id SET NOT NULL;
    -- app_settings stays nullable transition-friendly; we'll enforce in app logic
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_location  ON public.staff(location_id);
CREATE INDEX IF NOT EXISTS idx_shifts_location ON public.shifts(location_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_location ON public.app_settings(location_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_settings_location ON public.app_settings(location_id);

-- =========================================================
-- 9. REWRITE POLICIES ON EXISTING TABLES
-- =========================================================
-- Drop all existing policies on these tables
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
           WHERE schemaname='public'
             AND tablename IN ('app_settings','staff','shifts','shift_servers','shift_bartenders','shift_support')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- APP_SETTINGS: members read; managers+ write
CREATE POLICY "Members read settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (location_id IS NOT NULL AND public.is_location_member(auth.uid(), location_id));
CREATE POLICY "Managers write settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (location_id IS NOT NULL AND public.can_manage_location(auth.uid(), location_id))
  WITH CHECK (location_id IS NOT NULL AND public.can_manage_location(auth.uid(), location_id));

-- STAFF: members read; managers+ write
CREATE POLICY "Members read staff" ON public.staff
  FOR SELECT TO authenticated
  USING (public.is_location_member(auth.uid(), location_id));
CREATE POLICY "Managers write staff" ON public.staff
  FOR ALL TO authenticated
  USING (public.can_manage_location(auth.uid(), location_id))
  WITH CHECK (public.can_manage_location(auth.uid(), location_id));

-- SHIFTS: members read; managers+ write any, staff can insert own (we'll enforce ownership at app layer for now via shift_servers linkage)
CREATE POLICY "Members read shifts" ON public.shifts
  FOR SELECT TO authenticated
  USING (public.is_location_member(auth.uid(), location_id));
CREATE POLICY "Members write shifts" ON public.shifts
  FOR ALL TO authenticated
  USING (public.is_location_member(auth.uid(), location_id))
  WITH CHECK (public.is_location_member(auth.uid(), location_id));

-- SHIFT_* tables: inherit via parent shift
CREATE POLICY "Members read shift_servers" ON public.shift_servers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts s
                 WHERE s.id = shift_id AND public.is_location_member(auth.uid(), s.location_id)));
CREATE POLICY "Members write shift_servers" ON public.shift_servers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts s
                 WHERE s.id = shift_id AND public.is_location_member(auth.uid(), s.location_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shifts s
                      WHERE s.id = shift_id AND public.is_location_member(auth.uid(), s.location_id)));

CREATE POLICY "Members read shift_bartenders" ON public.shift_bartenders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts s
                 WHERE s.id = shift_id AND public.is_location_member(auth.uid(), s.location_id)));
CREATE POLICY "Members write shift_bartenders" ON public.shift_bartenders
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts s
                 WHERE s.id = shift_id AND public.is_location_member(auth.uid(), s.location_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shifts s
                      WHERE s.id = shift_id AND public.is_location_member(auth.uid(), s.location_id)));

CREATE POLICY "Members read shift_support" ON public.shift_support
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts s
                 WHERE s.id = shift_id AND public.is_location_member(auth.uid(), s.location_id)));
CREATE POLICY "Members write shift_support" ON public.shift_support
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts s
                 WHERE s.id = shift_id AND public.is_location_member(auth.uid(), s.location_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shifts s
                      WHERE s.id = shift_id AND public.is_location_member(auth.uid(), s.location_id)));

-- =========================================================
-- 10. INVITES
-- =========================================================
CREATE TABLE public.location_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.location_role NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_invites TO authenticated;
GRANT ALL ON public.location_invites TO service_role;
ALTER TABLE public.location_invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_invites_email ON public.location_invites(lower(email));

CREATE POLICY "Managers view invites" ON public.location_invites
  FOR SELECT TO authenticated
  USING (public.can_manage_location(auth.uid(), location_id));
CREATE POLICY "Owners manage invites" ON public.location_invites
  FOR ALL TO authenticated
  USING (public.has_location_role(auth.uid(), location_id, 'owner'))
  WITH CHECK (public.has_location_role(auth.uid(), location_id, 'owner'));
