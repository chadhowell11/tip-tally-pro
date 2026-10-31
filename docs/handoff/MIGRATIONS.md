<!-- Historical record IDs in SQL bodies redacted; filename suffixes preserved. SQL bodies are reference-only and not executable. -->
# Migration inventory

Repository file order is chronological by filename. Live migration-ledger versions are listed separately because they do not necessarily match local file timestamps. The current catalog, not historical DDL, is the schema.sql source of truth.

## Local files

### `supabase/migrations/20260627161109_8c8cb8f4-8a47-4158-bc7e-2c434d765fbc.sql`

```sql

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.staff_role AS ENUM ('server', 'bartender', 'runner', 'busser', 'bar_back');
CREATE TYPE public.shift_period AS ENUM ('AM', 'PM');

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: first signed-up user automatically becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_admin();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- App settings (single row enforced)
CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  establishment_name TEXT NOT NULL DEFAULT 'My Establishment',
  logo_url TEXT,
  bar_tip_pct NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  runner_busser_tip_pct NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  weight_runner NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  weight_busser NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  weight_bar_back NUMERIC(4,2) NOT NULL DEFAULT 0.5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads settings" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert settings" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed singleton settings row
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Staff
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  server_number TEXT,
  role public.staff_role NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX staff_role_active_idx ON public.staff (role, active);
GRANT SELECT ON public.staff TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads staff" ON public.staff
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage staff" ON public.staff
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER staff_updated_at BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Shifts
CREATE TABLE public.shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_date DATE NOT NULL,
  period public.shift_period NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shifts_date_idx ON public.shifts (shift_date DESC);
GRANT SELECT, INSERT, UPDATE ON public.shifts TO anon, authenticated;
GRANT DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads shifts" ON public.shifts
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone creates shifts" ON public.shifts
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone updates shifts" ON public.shifts
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete shifts" ON public.shifts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-server shift entries
CREATE TABLE public.shift_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  cash_owed NUMERIC(10,2) NOT NULL DEFAULT 0,
  credit_tips NUMERIC(10,2) NOT NULL DEFAULT 0,
  lbw_sales NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shift_servers_shift_idx ON public.shift_servers (shift_id);
CREATE INDEX shift_servers_staff_idx ON public.shift_servers (staff_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_servers TO anon, authenticated;
GRANT ALL ON public.shift_servers TO service_role;
ALTER TABLE public.shift_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access shift_servers" ON public.shift_servers
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Per-bartender shift entries
CREATE TABLE public.shift_bartenders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  credit_tips NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shift_bartenders_shift_idx ON public.shift_bartenders (shift_id);
CREATE INDEX shift_bartenders_staff_idx ON public.shift_bartenders (staff_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_bartenders TO anon, authenticated;
GRANT ALL ON public.shift_bartenders TO service_role;
ALTER TABLE public.shift_bartenders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access shift_bartenders" ON public.shift_bartenders
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Per-support-staff (runner/busser/bar back) entries with hours
CREATE TABLE public.shift_support (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  hours_worked NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shift_support_shift_idx ON public.shift_support (shift_id);
CREATE INDEX shift_support_staff_idx ON public.shift_support (staff_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_support TO anon, authenticated;
GRANT ALL ON public.shift_support TO service_role;
ALTER TABLE public.shift_support ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access shift_support" ON public.shift_support
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

```

### `supabase/migrations/20260627161130_4bdefadd-a12f-40e3-89fa-d7fe1fed1425.sql`

```sql

CREATE POLICY "Anyone can view logos" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'logos');
CREATE POLICY "Admins upload logos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update logos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete logos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));

```

### `supabase/migrations/20260627161144_8a22a3a9-1695-40a0-a403-c297602689d4.sql`

```sql

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

```

### `supabase/migrations/20260627163830_0337f166-830a-4162-8886-d12f55cbf9ad.sql`

```sql
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'hostess';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS weight_hostess NUMERIC(4,2) NOT NULL DEFAULT 0.5;
```

### `supabase/migrations/20260627164157_2e8f5573-d830-4e0f-9243-22f3a84cbad6.sql`

```sql
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS max_tipout_pct NUMERIC(5,4) NOT NULL DEFAULT 0.30;
```

### `supabase/migrations/20260627171432_3ef321cb-281b-4e89-a236-fbe7140bdc17.sql`

```sql

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

```

### `supabase/migrations/20260627192010_e93e9816-f0e1-4223-95a6-7e285fd53a8a.sql`

```sql
CREATE TABLE public.staff_positions (
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  position staff_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, position)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_positions TO authenticated;
GRANT ALL ON public.staff_positions TO service_role;

ALTER TABLE public.staff_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read staff_positions" ON public.staff_positions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_positions.staff_id AND is_location_member(auth.uid(), s.location_id)));

CREATE POLICY "Managers write staff_positions" ON public.staff_positions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_positions.staff_id AND can_manage_location(auth.uid(), s.location_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_positions.staff_id AND can_manage_location(auth.uid(), s.location_id)));

CREATE INDEX staff_positions_position_idx ON public.staff_positions(position);

-- Backfill from existing staff.role
INSERT INTO public.staff_positions (staff_id, position)
SELECT id, role FROM public.staff
ON CONFLICT DO NOTHING;
```

### `supabase/migrations/20260627195953_dd3f8169-d4a4-4f42-83dc-928940c7541c.sql`

```sql
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;
```

### `supabase/migrations/20260627204538_20e9a678-c65e-4d3a-9e18-d692ae4682eb.sql`

```sql
UPDATE public.app_settings SET location_id = '<historical-uuid-redacted>' WHERE id = 1 AND location_id IS NULL;
```

### `supabase/migrations/20260627220008_9a4caffe-808a-44eb-b475-cf281fdb9ee4.sql`

```sql
ALTER TABLE public.shift_bartenders ADD COLUMN IF NOT EXISTS cash_owed numeric NOT NULL DEFAULT 0;
```

### `supabase/migrations/20260703173748_1455c8f8-0561-49cf-937e-0c1f040ef5b6.sql`

```sql

ALTER TABLE public.shift_servers
  ADD COLUMN IF NOT EXISTS bar_tip_override numeric,
  ADD COLUMN IF NOT EXISTS rb_tip_override numeric;
ALTER TABLE public.shift_bartenders
  ADD COLUMN IF NOT EXISTS rb_tip_override numeric;

```

### `supabase/migrations/20260703183821_c5a38d9d-a4d4-49c9-b9a2-50119ecd7e7d.sql`

```sql
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS bartender_tip_pct numeric NOT NULL DEFAULT 0.10;
```

### `supabase/migrations/20260703200115_70df26d3-b7dd-45ee-b12a-8d43cf61d1b5.sql`

```sql
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS rounding_mode text NOT NULL DEFAULT 'nearest' CHECK (rounding_mode IN ('nearest','up','down'));
```

### `supabase/migrations/20260703201050_3332f9a8-6c9f-498f-a0da-d82a8b75790d.sql`

```sql
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_rounding_mode_check;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_rounding_mode_check CHECK (rounding_mode IN ('none','nearest','up','down'));
```

### `supabase/migrations/20260703205106_87f5e0ca-43c0-4d86-afac-f00adb5dccbe.sql`

```sql

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS use_net_sales boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sales_tax_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cc_fee_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cc_fee_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manager_exclusion_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false;

```

### `supabase/migrations/20260714211933_e6d73bbc-7137-45b7-a277-d2e1df4618fe.sql`

```sql

-- Allow a bartender entry to be a shared cash-out for multiple bartenders.
ALTER TABLE public.shift_bartenders
  ADD COLUMN IF NOT EXISTS split_mode text NOT NULL DEFAULT 'single'
    CHECK (split_mode IN ('single','equal','hours'));
ALTER TABLE public.shift_bartenders
  ALTER COLUMN staff_id DROP NOT NULL;

CREATE TABLE public.shift_bartender_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_bartender_id uuid NOT NULL REFERENCES public.shift_bartenders(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  hours_worked numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_bartender_id, staff_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_bartender_members TO authenticated;
GRANT ALL ON public.shift_bartender_members TO service_role;

ALTER TABLE public.shift_bartender_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read shift_bartender_members"
  ON public.shift_bartender_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shift_bartenders sb
    JOIN public.shifts s ON s.id = sb.shift_id
    WHERE sb.id = shift_bartender_members.shift_bartender_id
      AND public.is_location_member(auth.uid(), s.location_id)
  ));

CREATE POLICY "Members write shift_bartender_members"
  ON public.shift_bartender_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.shift_bartenders sb
    JOIN public.shifts s ON s.id = sb.shift_id
    WHERE sb.id = shift_bartender_members.shift_bartender_id
      AND public.is_location_member(auth.uid(), s.location_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shift_bartenders sb
    JOIN public.shifts s ON s.id = sb.shift_id
    WHERE sb.id = shift_bartender_members.shift_bartender_id
      AND public.is_location_member(auth.uid(), s.location_id)
  ));

CREATE TRIGGER set_shift_bartender_members_updated_at
  BEFORE UPDATE ON public.shift_bartender_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

```

### `supabase/migrations/20260728214121_141e5e0c-008e-4d6f-8e66-055f439ac15d.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS shifts_unique_date_period_location ON public.shifts (location_id, shift_date, period);
```

### `supabase/migrations/20260730164635_2195112a-5f6c-40d3-925d-68696059bc5c.sql`

```sql
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
```

### `supabase/migrations/20260730170047_a37043d0-f14b-4a7b-a10b-94a05c69faad.sql`

```sql
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email TEXT, ADD COLUMN IF NOT EXISTS phone TEXT;
```

### `supabase/migrations/20260730173818_b6bfc2be-1dff-4c05-8885-6678fb80a81b.sql`

```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_from_number TEXT,
  ADD COLUMN IF NOT EXISTS sms_include_breakdown BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.sms_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  provider_sid TEXT,
  error TEXT,
  sent_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_sends_shift_idx ON public.sms_sends (shift_id);
CREATE INDEX IF NOT EXISTS sms_sends_location_created_idx ON public.sms_sends (location_id, created_at DESC);

GRANT SELECT, INSERT ON public.sms_sends TO authenticated;
GRANT ALL ON public.sms_sends TO service_role;

ALTER TABLE public.sms_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view sms sends" ON public.sms_sends;
CREATE POLICY "Members view sms sends" ON public.sms_sends
  FOR SELECT TO authenticated
  USING (public.is_location_member(auth.uid(), location_id));

DROP POLICY IF EXISTS "Members record sms sends" ON public.sms_sends;
CREATE POLICY "Members record sms sends" ON public.sms_sends
  FOR INSERT TO authenticated
  WITH CHECK (public.is_location_member(auth.uid(), location_id));
```

### `supabase/migrations/20260730181244_45a12925-ad98-4d95-8adc-44e8b1346129.sql`

```sql
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS singleton;

DROP POLICY IF EXISTS "Members view their locations" ON public.locations;
CREATE POLICY "Members view their locations"
ON public.locations FOR SELECT TO authenticated
USING (public.is_location_member(auth.uid(), id) OR owner_user_id = auth.uid());

DELETE FROM public.locations WHERE name IN ('RLS Probe','RLS Probe2');
```

### `supabase/migrations/20260730181326_46213e35-325d-43e3-982c-1cc3689c8006.sql`

```sql
CREATE POLICY "Owner can bootstrap own membership"
ON public.location_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'owner'::location_role
  AND EXISTS (SELECT 1 FROM public.locations l WHERE l.id = location_members.location_id AND l.owner_user_id = auth.uid())
);

DELETE FROM public.locations WHERE name LIKE 'RLS Probe%';
```

### `supabase/migrations/20260730183431_7d67ccab-48f8-42f7-9ed1-568d6b63c5eb.sql`

```sql
DELETE FROM public.app_settings WHERE location_id = '<historical-uuid-redacted>';
DELETE FROM public.location_members WHERE location_id = '<historical-uuid-redacted>';
DELETE FROM public.locations WHERE id = '<historical-uuid-redacted>';
DELETE FROM public.location_members WHERE user_id = '<historical-uuid-redacted>';
DELETE FROM public.profiles WHERE user_id = '<historical-uuid-redacted>';
DELETE FROM auth.users WHERE id = '<historical-uuid-redacted>';
```

### `supabase/migrations/20260730184600_97f36102-0fb7-441a-ae9f-724810741907.sql`

```sql
create or replace function public.grant_admin_to_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'owner' then
    insert into public.user_roles (user_id, role)
    values (new.user_id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_grant_admin_to_owner on public.location_members;
create trigger trg_grant_admin_to_owner
after insert on public.location_members
for each row execute function public.grant_admin_to_owner();

insert into public.user_roles (user_id, role)
select distinct lm.user_id, 'admin'::app_role
from public.location_members lm
where lm.role = 'owner'
on conflict (user_id, role) do nothing;
```

### `supabase/migrations/20260730185848_209e05f5-804f-4b24-843a-48817f78658e.sql`

```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS rb_basis text NOT NULL DEFAULT 'tips'
    CHECK (rb_basis IN ('tips','sales'));

ALTER TABLE public.shift_servers
  ADD COLUMN IF NOT EXISTS total_sales numeric NOT NULL DEFAULT 0;

ALTER TABLE public.shift_bartenders
  ADD COLUMN IF NOT EXISTS total_sales numeric NOT NULL DEFAULT 0;
```

### `supabase/migrations/20260730195330_617fdc7f-64f8-4404-9013-dadfb94e2695.sql`

```sql
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
```

### `supabase/migrations/20260804154929_f0f44425-280b-4671-896f-516439db7874.sql`

```sql
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS support_split_mode text NOT NULL DEFAULT 'weighted';
ALTER TABLE public.shifts ADD CONSTRAINT shifts_support_split_mode_check CHECK (support_split_mode IN ('shared','weighted'));
```

### `supabase/migrations/20260806195650_c02fed07-0165-4ac3-ae54-205580b4fc77.sql`

```sql
CREATE TABLE public.settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.settings_audit TO authenticated;
GRANT ALL ON public.settings_audit TO service_role;

ALTER TABLE public.settings_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view settings audit" ON public.settings_audit
FOR SELECT TO authenticated
USING (public.can_admin_location(auth.uid(), location_id));

CREATE INDEX settings_audit_location_created_idx ON public.settings_audit (location_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text := auth.jwt() ->> 'email';
  oldj jsonb := to_jsonb(OLD);
  newj jsonb := to_jsonb(NEW);
  k text;
BEGIN
  IF NEW.location_id IS NULL THEN RETURN NEW; END IF;
  FOR k IN SELECT jsonb_object_keys(newj) LOOP
    IF k IN ('id','location_id','updated_at') THEN CONTINUE; END IF;
    IF (newj -> k) IS DISTINCT FROM (oldj -> k) THEN
      INSERT INTO public.settings_audit (location_id, field, old_value, new_value, changed_by, changed_by_email)
      VALUES (NEW.location_id, k, oldj ->> k, newj ->> k, uid, uemail);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_settings_audit
AFTER UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.log_settings_change();
```

### `supabase/migrations/20260818014829_071509b6-eb8c-4506-a813-2b16be3ca7df.sql`

```sql
ALTER TABLE public.shift_servers ALTER COLUMN staff_id DROP NOT NULL;
ALTER TABLE public.shift_servers ADD COLUMN IF NOT EXISTS split_mode text NOT NULL DEFAULT 'single';
ALTER TABLE public.shift_servers ADD CONSTRAINT shift_servers_split_mode_check CHECK (split_mode IN ('single','equal','hours'));

CREATE TABLE public.shift_server_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_server_id uuid NOT NULL REFERENCES public.shift_servers(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  hours_worked numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_server_members TO authenticated;
GRANT ALL ON public.shift_server_members TO service_role;

ALTER TABLE public.shift_server_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read shift_server_members" ON public.shift_server_members
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.shift_servers ss JOIN public.shifts s ON s.id = ss.shift_id
  WHERE ss.id = shift_server_members.shift_server_id AND public.is_location_member(auth.uid(), s.location_id)
));

CREATE POLICY "Members write shift_server_members" ON public.shift_server_members
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.shift_servers ss JOIN public.shifts s ON s.id = ss.shift_id
  WHERE ss.id = shift_server_members.shift_server_id AND public.is_location_member(auth.uid(), s.location_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shift_servers ss JOIN public.shifts s ON s.id = ss.shift_id
  WHERE ss.id = shift_server_members.shift_server_id AND public.is_location_member(auth.uid(), s.location_id)
));

CREATE TRIGGER shift_server_members_updated_at BEFORE UPDATE ON public.shift_server_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_shift_server_members_shift_server_id ON public.shift_server_members(shift_server_id);
```

### `supabase/migrations/20260818042409_eb6c540b-fbcd-4cb9-a1e3-68698a8011d1.sql`

```sql
ALTER TABLE public.shift_support ADD COLUMN IF NOT EXISTS role staff_role;
```

### `supabase/migrations/20260818042505_c2851ee1-ae93-46d2-b511-f495042a76b2.sql`

```sql
UPDATE public.shift_support ss
SET role = COALESCE(
  (SELECT sp.position FROM public.staff_positions sp
   WHERE sp.staff_id = ss.staff_id
     AND sp.position IN ('runner','busser','bar_back','hostess')
   ORDER BY CASE sp.position WHEN 'runner' THEN 1 WHEN 'busser' THEN 2 WHEN 'bar_back' THEN 3 ELSE 4 END
   LIMIT 1),
  'runner'::staff_role)
WHERE ss.role IS NULL;
```

## Live migration ledger

```json
[
  {
    "name": "",
    "version": "20260627161107"
  },
  {
    "name": "",
    "version": "20260627161129"
  },
  {
    "name": "",
    "version": "20260627161143"
  },
  {
    "name": "",
    "version": "20260627163827"
  },
  {
    "name": "",
    "version": "20260627164155"
  },
  {
    "name": "",
    "version": "20260627171430"
  },
  {
    "name": "",
    "version": "20260627192008"
  },
  {
    "name": "",
    "version": "20260627195951"
  },
  {
    "name": "",
    "version": "20260627204536"
  },
  {
    "name": "",
    "version": "20260627220005"
  },
  {
    "name": "20260703173748_<historical-uuid-redacted>",
    "version": "20260703173750"
  },
  {
    "name": "20260703183821_<historical-uuid-redacted>",
    "version": "20260703183823"
  },
  {
    "name": "20260703200115_<historical-uuid-redacted>",
    "version": "20260703200118"
  },
  {
    "name": "20260703201050_<historical-uuid-redacted>",
    "version": "20260703201055"
  },
  {
    "name": "20260703205106_<historical-uuid-redacted>",
    "version": "20260703205108"
  },
  {
    "name": "20260714211933_<historical-uuid-redacted>",
    "version": "20260714211935"
  },
  {
    "name": "20260728214121_<historical-uuid-redacted>",
    "version": "20260728214122"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260730164635"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260730170047"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260730173818"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260730181244"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260730181326"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260730183431"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260730184600"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260730185848"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260730195330"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260804154929"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260806194340"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260806195650"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260818014829"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260818042409"
  },
  {
    "name": "<historical-uuid-redacted>",
    "version": "20260818042505"
  }
]
```

## Gaps / portability

The live `tip_override_audit` table and `log_tip_override` function/triggers exist, but a creation migration is missing locally. The live `staff_role` enum contains hostess, without a local ADD VALUE migration. These are included from the catalog in schema.sql. Migration replay is UNVERIFIED; the ledger is not a source for the original missing SQL. Environment-specific cleanup/confirmation statements are historical data mutations, not portable schema creation. Never run these migrations against real records without review.
