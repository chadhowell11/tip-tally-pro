
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
