-- Tip Share application schema: catalog snapshot 2026-10-31 UTC.
-- Read-only extraction from current database; no SQL below was applied.
-- This is application DDL, not a full managed-platform/database backup.
-- Prerequisites: PostgreSQL with auth.users, auth.uid(), auth.jwt(),
-- auth/storage schemas and anon/authenticated/service_role roles provisioned by the target platform.
-- Extension schemas and managed service internals are intentionally not reconstructed.
-- Current data, passwords, credentials, owners, sequence last_value and storage objects are NOT exported.
-- Review MAINTAIN privileges for compatibility with the target PostgreSQL version.
CREATE SCHEMA IF NOT EXISTS public;

GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT USAGE ON SCHEMA public TO "anon";
GRANT USAGE ON SCHEMA public TO "authenticated";
GRANT USAGE ON SCHEMA public TO "service_role";
CREATE TYPE public."app_role" AS ENUM ('admin', 'user');
CREATE TYPE public."location_role" AS ENUM ('owner', 'manager', 'staff', 'admin');
CREATE TYPE public."shift_period" AS ENUM ('AM', 'PM');
CREATE TYPE public."staff_role" AS ENUM ('server', 'bartender', 'runner', 'busser', 'bar_back', 'hostess');
CREATE TYPE public."subscription_status" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
CREATE SEQUENCE public."app_settings_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE TABLE public."app_settings" (
  "id" integer DEFAULT nextval('app_settings_id_seq'::regclass) NOT NULL,
  "establishment_name" text DEFAULT 'My Establishment'::text NOT NULL,
  "logo_url" text,
  "bar_tip_pct" numeric(5,4) DEFAULT 0.10 NOT NULL,
  "runner_busser_tip_pct" numeric(5,4) DEFAULT 0.10 NOT NULL,
  "weight_runner" numeric(4,2) DEFAULT 1.0 NOT NULL,
  "weight_busser" numeric(4,2) DEFAULT 1.0 NOT NULL,
  "weight_bar_back" numeric(4,2) DEFAULT 0.5 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "weight_hostess" numeric(4,2) DEFAULT 0.5 NOT NULL,
  "max_tipout_pct" numeric(5,4) DEFAULT 0.30 NOT NULL,
  "location_id" uuid NOT NULL,
  "bartender_tip_pct" numeric DEFAULT 0.10 NOT NULL,
  "rounding_mode" text DEFAULT 'nearest'::text NOT NULL,
  "use_net_sales" boolean DEFAULT false NOT NULL,
  "sales_tax_pct" numeric DEFAULT 0 NOT NULL,
  "cc_fee_enabled" boolean DEFAULT false NOT NULL,
  "cc_fee_pct" numeric DEFAULT 0 NOT NULL,
  "manager_exclusion_enabled" boolean DEFAULT false NOT NULL,
  "pay_period_type" text DEFAULT 'biweekly'::text NOT NULL,
  "pay_period_anchor" date,
  "sms_enabled" boolean DEFAULT false NOT NULL,
  "sms_from_number" text,
  "sms_include_breakdown" boolean DEFAULT true NOT NULL,
  "rb_basis" text DEFAULT 'tips'::text NOT NULL
);

CREATE TABLE public."location_invites" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL,
  "email" text NOT NULL,
  "role" public."location_role" NOT NULL,
  "token" text DEFAULT encode(extensions.gen_random_bytes(24), 'hex'::text) NOT NULL,
  "invited_by" uuid NOT NULL,
  "accepted_at" timestamp with time zone,
  "expires_at" timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."location_members" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" public."location_role" NOT NULL,
  "staff_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."locations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "plan" text,
  "status" public."subscription_status" DEFAULT 'trialing'::subscription_status NOT NULL,
  "trial_ends_at" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "logo_url" text,
  "timezone" text DEFAULT 'America/New_York'::text NOT NULL,
  "establishment_type" text,
  "address" text,
  "setup_completed_at" timestamp with time zone,
  "setup_steps" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public."profiles" (
  "user_id" uuid NOT NULL,
  "full_name" text,
  "email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."settings_audit" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL,
  "field" text NOT NULL,
  "old_value" text,
  "new_value" text,
  "changed_by" uuid,
  "changed_by_email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."shift_bartender_members" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shift_bartender_id" uuid NOT NULL,
  "staff_id" uuid NOT NULL,
  "hours_worked" numeric DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."shift_bartenders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shift_id" uuid NOT NULL,
  "staff_id" uuid,
  "credit_tips" numeric(10,2) DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "cash_owed" numeric DEFAULT 0 NOT NULL,
  "rb_tip_override" numeric,
  "split_mode" text DEFAULT 'single'::text NOT NULL,
  "total_sales" numeric DEFAULT 0 NOT NULL
);

CREATE TABLE public."shift_server_members" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shift_server_id" uuid NOT NULL,
  "staff_id" uuid NOT NULL,
  "hours_worked" numeric DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."shift_servers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shift_id" uuid NOT NULL,
  "staff_id" uuid,
  "cash_owed" numeric(10,2) DEFAULT 0 NOT NULL,
  "credit_tips" numeric(10,2) DEFAULT 0 NOT NULL,
  "lbw_sales" numeric(10,2) DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "bar_tip_override" numeric,
  "rb_tip_override" numeric,
  "total_sales" numeric DEFAULT 0 NOT NULL,
  "split_mode" text DEFAULT 'single'::text NOT NULL
);

CREATE TABLE public."shift_support" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shift_id" uuid NOT NULL,
  "staff_id" uuid NOT NULL,
  "hours_worked" numeric(5,2) DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "role" public."staff_role"
);

CREATE TABLE public."shifts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shift_date" date NOT NULL,
  "period" public."shift_period" NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "location_id" uuid,
  "support_split_mode" text DEFAULT 'weighted'::text NOT NULL
);

CREATE TABLE public."sms_sends" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL,
  "shift_id" uuid,
  "staff_id" uuid,
  "phone" text NOT NULL,
  "body" text NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "provider_sid" text,
  "error" text,
  "sent_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."staff" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "server_number" text,
  "role" public."staff_role" NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "location_id" uuid,
  "is_manager" boolean DEFAULT false NOT NULL,
  "email" text,
  "phone" text
);

CREATE TABLE public."staff_positions" (
  "staff_id" uuid NOT NULL,
  "position" public."staff_role" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."tip_override_audit" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL,
  "shift_id" uuid,
  "shift_date" date,
  "period" text,
  "entry_kind" text NOT NULL,
  "entry_id" uuid,
  "staff_id" uuid,
  "field" text NOT NULL,
  "auto_amount" numeric,
  "old_amount" numeric,
  "new_amount" numeric,
  "action" text NOT NULL,
  "changed_by" uuid,
  "changed_by_email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."user_roles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "role" public."app_role" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."app_settings" ADD CONSTRAINT "app_settings_location_id_key" UNIQUE (location_id);
ALTER TABLE public."app_settings" ADD CONSTRAINT "app_settings_pay_period_type_check" CHECK (pay_period_type = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'semimonthly'::text, 'monthly'::text]));
ALTER TABLE public."app_settings" ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY (id);
ALTER TABLE public."app_settings" ADD CONSTRAINT "app_settings_rb_basis_check" CHECK (rb_basis = ANY (ARRAY['tips'::text, 'sales'::text]));
ALTER TABLE public."app_settings" ADD CONSTRAINT "app_settings_rounding_mode_check" CHECK (rounding_mode = ANY (ARRAY['none'::text, 'nearest'::text, 'up'::text, 'down'::text]));
ALTER TABLE public."location_invites" ADD CONSTRAINT "location_invites_pkey" PRIMARY KEY (id);
ALTER TABLE public."location_invites" ADD CONSTRAINT "location_invites_token_key" UNIQUE (token);
ALTER TABLE public."location_members" ADD CONSTRAINT "location_members_location_id_user_id_key" UNIQUE (location_id, user_id);
ALTER TABLE public."location_members" ADD CONSTRAINT "location_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."locations" ADD CONSTRAINT "locations_pkey" PRIMARY KEY (id);
ALTER TABLE public."locations" ADD CONSTRAINT "locations_stripe_customer_id_key" UNIQUE (stripe_customer_id);
ALTER TABLE public."locations" ADD CONSTRAINT "locations_stripe_subscription_id_key" UNIQUE (stripe_subscription_id);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."settings_audit" ADD CONSTRAINT "settings_audit_pkey" PRIMARY KEY (id);
ALTER TABLE public."shift_bartender_members" ADD CONSTRAINT "shift_bartender_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."shift_bartender_members" ADD CONSTRAINT "shift_bartender_members_shift_bartender_id_staff_id_key" UNIQUE (shift_bartender_id, staff_id);
ALTER TABLE public."shift_bartenders" ADD CONSTRAINT "shift_bartenders_pkey" PRIMARY KEY (id);
ALTER TABLE public."shift_bartenders" ADD CONSTRAINT "shift_bartenders_split_mode_check" CHECK (split_mode = ANY (ARRAY['single'::text, 'equal'::text, 'hours'::text]));
ALTER TABLE public."shift_server_members" ADD CONSTRAINT "shift_server_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."shift_servers" ADD CONSTRAINT "shift_servers_pkey" PRIMARY KEY (id);
ALTER TABLE public."shift_servers" ADD CONSTRAINT "shift_servers_split_mode_check" CHECK (split_mode = ANY (ARRAY['single'::text, 'equal'::text, 'hours'::text]));
ALTER TABLE public."shift_support" ADD CONSTRAINT "shift_support_pkey" PRIMARY KEY (id);
ALTER TABLE public."shifts" ADD CONSTRAINT "shifts_pkey" PRIMARY KEY (id);
ALTER TABLE public."shifts" ADD CONSTRAINT "shifts_support_split_mode_check" CHECK (support_split_mode = ANY (ARRAY['shared'::text, 'weighted'::text]));
ALTER TABLE public."sms_sends" ADD CONSTRAINT "sms_sends_pkey" PRIMARY KEY (id);
ALTER TABLE public."staff" ADD CONSTRAINT "staff_pkey" PRIMARY KEY (id);
ALTER TABLE public."staff_positions" ADD CONSTRAINT "staff_positions_pkey" PRIMARY KEY (staff_id, "position");
ALTER TABLE public."tip_override_audit" ADD CONSTRAINT "tip_override_audit_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE (user_id, role);
ALTER TABLE public."app_settings" ADD CONSTRAINT "app_settings_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE public."location_invites" ADD CONSTRAINT "location_invites_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."location_invites" ADD CONSTRAINT "location_invites_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE public."location_members" ADD CONSTRAINT "location_members_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE public."location_members" ADD CONSTRAINT "location_members_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE public."location_members" ADD CONSTRAINT "location_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."locations" ADD CONSTRAINT "locations_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."settings_audit" ADD CONSTRAINT "settings_audit_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE public."shift_bartender_members" ADD CONSTRAINT "shift_bartender_members_shift_bartender_id_fkey" FOREIGN KEY (shift_bartender_id) REFERENCES shift_bartenders(id) ON DELETE CASCADE;
ALTER TABLE public."shift_bartender_members" ADD CONSTRAINT "shift_bartender_members_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT;
ALTER TABLE public."shift_bartenders" ADD CONSTRAINT "shift_bartenders_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE;
ALTER TABLE public."shift_bartenders" ADD CONSTRAINT "shift_bartenders_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT;
ALTER TABLE public."shift_server_members" ADD CONSTRAINT "shift_server_members_shift_server_id_fkey" FOREIGN KEY (shift_server_id) REFERENCES shift_servers(id) ON DELETE CASCADE;
ALTER TABLE public."shift_server_members" ADD CONSTRAINT "shift_server_members_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE public."shift_servers" ADD CONSTRAINT "shift_servers_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE;
ALTER TABLE public."shift_servers" ADD CONSTRAINT "shift_servers_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT;
ALTER TABLE public."shift_support" ADD CONSTRAINT "shift_support_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE;
ALTER TABLE public."shift_support" ADD CONSTRAINT "shift_support_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT;
ALTER TABLE public."shifts" ADD CONSTRAINT "shifts_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE public."sms_sends" ADD CONSTRAINT "sms_sends_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE public."sms_sends" ADD CONSTRAINT "sms_sends_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE;
ALTER TABLE public."sms_sends" ADD CONSTRAINT "sms_sends_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE public."staff" ADD CONSTRAINT "staff_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE public."staff_positions" ADD CONSTRAINT "staff_positions_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE public."tip_override_audit" ADD CONSTRAINT "tip_override_audit_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE public."tip_override_audit" ADD CONSTRAINT "tip_override_audit_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
ALTER TABLE public."tip_override_audit" ADD CONSTRAINT "tip_override_audit_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER SEQUENCE public.app_settings_id_seq OWNED BY public.app_settings.id;
CREATE INDEX idx_app_settings_location ON public.app_settings USING btree (location_id);
CREATE UNIQUE INDEX uq_app_settings_location ON public.app_settings USING btree (location_id);
CREATE INDEX idx_invites_email ON public.location_invites USING btree (lower(email));
CREATE UNIQUE INDEX location_invites_pending_email_idx ON public.location_invites USING btree (location_id, lower(email)) WHERE (accepted_at IS NULL);
CREATE INDEX settings_audit_location_created_idx ON public.settings_audit USING btree (location_id, created_at DESC);
CREATE INDEX shift_bartenders_shift_idx ON public.shift_bartenders USING btree (shift_id);
CREATE INDEX shift_bartenders_staff_idx ON public.shift_bartenders USING btree (staff_id);
CREATE INDEX idx_shift_server_members_shift_server_id ON public.shift_server_members USING btree (shift_server_id);
CREATE INDEX shift_servers_shift_idx ON public.shift_servers USING btree (shift_id);
CREATE INDEX shift_servers_staff_idx ON public.shift_servers USING btree (staff_id);
CREATE INDEX shift_support_shift_idx ON public.shift_support USING btree (shift_id);
CREATE INDEX shift_support_staff_idx ON public.shift_support USING btree (staff_id);
CREATE INDEX idx_shifts_location ON public.shifts USING btree (location_id);
CREATE INDEX shifts_date_idx ON public.shifts USING btree (shift_date DESC);
CREATE UNIQUE INDEX shifts_unique_date_period_location ON public.shifts USING btree (location_id, shift_date, period);
CREATE INDEX sms_sends_location_created_idx ON public.sms_sends USING btree (location_id, created_at DESC);
CREATE INDEX sms_sends_shift_idx ON public.sms_sends USING btree (shift_id);
CREATE INDEX idx_staff_location ON public.staff USING btree (location_id);
CREATE INDEX staff_role_active_idx ON public.staff USING btree (role, active);
CREATE INDEX staff_positions_position_idx ON public.staff_positions USING btree ("position");
CREATE INDEX tip_override_audit_loc_date_idx ON public.tip_override_audit USING btree (location_id, shift_date DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.accept_location_invite(_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.can_admin_location(_user_id uuid, _location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id
                   AND role::text IN ('owner', 'admin'))
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_location(_user_id uuid, _location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id
                   AND role::text IN ('owner', 'admin', 'manager'))
$function$;

CREATE OR REPLACE FUNCTION public.create_default_app_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.app_settings (location_id, establishment_name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (location_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_admin_to_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role::text IN ('owner', 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_location_role(_user_id uuid, _location_id uuid, _role location_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id AND role = _role)
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$function$;

CREATE OR REPLACE FUNCTION public.is_location_member(_user_id uuid, _location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id)
$function$;

CREATE OR REPLACE FUNCTION public.log_settings_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.log_tip_override()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.shifts%ROWTYPE;
  uid uuid := auth.uid();
  uemail text := auth.jwt() ->> 'email';
  kind text := CASE WHEN TG_TABLE_NAME = 'shift_servers' THEN 'server' ELSE 'bartender' END;
  oldbar numeric;
  newbar numeric;
  oldrb numeric;
  newrb numeric;
BEGIN
  SELECT * INTO s FROM public.shifts WHERE id = NEW.shift_id;
  IF s.location_id IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'shift_servers' THEN
    oldbar := CASE WHEN TG_OP = 'UPDATE' THEN OLD.bar_tip_override ELSE NULL END;
    newbar := NEW.bar_tip_override;
    IF newbar IS DISTINCT FROM oldbar THEN
      INSERT INTO public.tip_override_audit (location_id, shift_id, shift_date, period, entry_kind, entry_id, staff_id, field, old_amount, new_amount, action, changed_by, changed_by_email)
      VALUES (s.location_id, NEW.shift_id, s.shift_date, s.period::text, kind, NEW.id, NEW.staff_id, 'bar_tip',
              oldbar, newbar,
              CASE WHEN newbar IS NULL THEN 'cleared' WHEN oldbar IS NULL THEN 'set' ELSE 'changed' END,
              uid, uemail);
    END IF;
  END IF;

  oldrb := CASE WHEN TG_OP = 'UPDATE' THEN OLD.rb_tip_override ELSE NULL END;
  newrb := NEW.rb_tip_override;
  IF newrb IS DISTINCT FROM oldrb THEN
    INSERT INTO public.tip_override_audit (location_id, shift_id, shift_date, period, entry_kind, entry_id, staff_id, field, old_amount, new_amount, action, changed_by, changed_by_email)
    VALUES (s.location_id, NEW.shift_id, s.shift_date, s.period::text, kind, NEW.id, NEW.staff_id, 'rb_tip',
            oldrb, newrb,
            CASE WHEN newrb IS NULL THEN 'cleared' WHEN oldrb IS NULL THEN 'set' ELSE 'changed' END,
            uid, uemail);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;
ALTER TABLE public."app_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."location_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."location_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."settings_audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shift_bartender_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shift_bartenders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shift_server_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shift_servers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shift_support" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sms_sends" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."staff_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tip_override_audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins write settings" ON "public"."app_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (((location_id IS NOT NULL) AND can_admin_location(auth.uid(), location_id))) WITH CHECK (((location_id IS NOT NULL) AND can_admin_location(auth.uid(), location_id)));
CREATE POLICY "Members read settings" ON "public"."app_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((location_id IS NOT NULL) AND is_location_member(auth.uid(), location_id)));
CREATE POLICY "Invitees can read their own invite" ON "public"."location_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));
CREATE POLICY "Managers manage invites for their location" ON "public"."location_invites" AS PERMISSIVE FOR ALL TO "authenticated" USING (can_manage_location(auth.uid(), location_id)) WITH CHECK (can_manage_location(auth.uid(), location_id));
CREATE POLICY "Managers view invites" ON "public"."location_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING (can_manage_location(auth.uid(), location_id));
CREATE POLICY "Owners manage invites" ON "public"."location_invites" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_location_role(auth.uid(), location_id, 'owner'::location_role)) WITH CHECK (has_location_role(auth.uid(), location_id, 'owner'::location_role));
CREATE POLICY "Members view membership of their locations" ON "public"."location_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_location_member(auth.uid(), location_id));
CREATE POLICY "Owner can bootstrap own membership" ON "public"."location_members" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = auth.uid()) AND (role = 'owner'::location_role) AND (EXISTS ( SELECT 1
   FROM locations l
  WHERE ((l.id = location_members.location_id) AND (l.owner_user_id = auth.uid()))))));
CREATE POLICY "Owners manage members" ON "public"."location_members" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_location_role(auth.uid(), location_id, 'owner'::location_role)) WITH CHECK (has_location_role(auth.uid(), location_id, 'owner'::location_role));
CREATE POLICY "Authenticated users create locations" ON "public"."locations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((owner_user_id = auth.uid()));
CREATE POLICY "Members view their locations" ON "public"."locations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_location_member(auth.uid(), id) OR (owner_user_id = auth.uid())));
CREATE POLICY "Owners update their location" ON "public"."locations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (has_location_role(auth.uid(), id, 'owner'::location_role)) WITH CHECK (has_location_role(auth.uid(), id, 'owner'::location_role));
CREATE POLICY "Users insert own profile" ON "public"."profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users update own profile" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users view own profile" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "Admins can view settings audit" ON "public"."settings_audit" AS PERMISSIVE FOR SELECT TO "authenticated" USING (can_admin_location(auth.uid(), location_id));
CREATE POLICY "Members read shift_bartender_members" ON "public"."shift_bartender_members" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (shift_bartenders sb
     JOIN shifts s ON ((s.id = sb.shift_id)))
  WHERE ((sb.id = shift_bartender_members.shift_bartender_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members write shift_bartender_members" ON "public"."shift_bartender_members" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (shift_bartenders sb
     JOIN shifts s ON ((s.id = sb.shift_id)))
  WHERE ((sb.id = shift_bartender_members.shift_bartender_id) AND is_location_member(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (shift_bartenders sb
     JOIN shifts s ON ((s.id = sb.shift_id)))
  WHERE ((sb.id = shift_bartender_members.shift_bartender_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members read shift_bartenders" ON "public"."shift_bartenders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_bartenders.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members write shift_bartenders" ON "public"."shift_bartenders" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_bartenders.shift_id) AND is_location_member(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_bartenders.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members read shift_server_members" ON "public"."shift_server_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (shift_servers ss
     JOIN shifts s ON ((s.id = ss.shift_id)))
  WHERE ((ss.id = shift_server_members.shift_server_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members write shift_server_members" ON "public"."shift_server_members" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (shift_servers ss
     JOIN shifts s ON ((s.id = ss.shift_id)))
  WHERE ((ss.id = shift_server_members.shift_server_id) AND is_location_member(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (shift_servers ss
     JOIN shifts s ON ((s.id = ss.shift_id)))
  WHERE ((ss.id = shift_server_members.shift_server_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members read shift_servers" ON "public"."shift_servers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_servers.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members write shift_servers" ON "public"."shift_servers" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_servers.shift_id) AND is_location_member(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_servers.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members read shift_support" ON "public"."shift_support" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_support.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members write shift_support" ON "public"."shift_support" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_support.shift_id) AND is_location_member(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_support.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members read shifts" ON "public"."shifts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_location_member(auth.uid(), location_id));
CREATE POLICY "Members write shifts" ON "public"."shifts" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_location_member(auth.uid(), location_id)) WITH CHECK (is_location_member(auth.uid(), location_id));
CREATE POLICY "Members record sms sends" ON "public"."sms_sends" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_location_member(auth.uid(), location_id));
CREATE POLICY "Members view sms sends" ON "public"."sms_sends" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_location_member(auth.uid(), location_id));
CREATE POLICY "Managers write staff" ON "public"."staff" AS PERMISSIVE FOR ALL TO "authenticated" USING (can_manage_location(auth.uid(), location_id)) WITH CHECK (can_manage_location(auth.uid(), location_id));
CREATE POLICY "Members read staff" ON "public"."staff" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_location_member(auth.uid(), location_id));
CREATE POLICY "Managers write staff_positions" ON "public"."staff_positions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM staff s
  WHERE ((s.id = staff_positions.staff_id) AND can_manage_location(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM staff s
  WHERE ((s.id = staff_positions.staff_id) AND can_manage_location(auth.uid(), s.location_id)))));
CREATE POLICY "Members read staff_positions" ON "public"."staff_positions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM staff s
  WHERE ((s.id = staff_positions.staff_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Admins can view tip override audit" ON "public"."tip_override_audit" AS PERMISSIVE FOR SELECT TO "authenticated" USING (can_admin_location(auth.uid(), location_id));
CREATE POLICY "Admins manage roles" ON "public"."user_roles" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all roles" ON "public"."user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own roles" ON "public"."user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = user_id));
CREATE TRIGGER on_auth_user_created_assign_admin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user_admin();
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();
CREATE TRIGGER app_settings_audit AFTER UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION log_settings_change();
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER location_invites_updated_at BEFORE UPDATE ON location_invites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_grant_admin_to_owner AFTER INSERT ON location_members FOR EACH ROW EXECUTE FUNCTION grant_admin_to_owner();
CREATE TRIGGER locations_create_default_settings AFTER INSERT ON locations FOR EACH ROW EXECUTE FUNCTION create_default_app_settings();
CREATE TRIGGER locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_shift_bartender_members_updated_at BEFORE UPDATE ON shift_bartender_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_log_tip_override_bartenders AFTER INSERT OR UPDATE ON shift_bartenders FOR EACH ROW EXECUTE FUNCTION log_tip_override();
CREATE TRIGGER shift_server_members_updated_at BEFORE UPDATE ON shift_server_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_log_tip_override_servers AFTER INSERT OR UPDATE ON shift_servers FOR EACH ROW EXECUTE FUNCTION log_tip_override();
CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION set_updated_at();
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."app_settings" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."app_settings" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."app_settings" TO "service_role";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public."app_settings_id_seq" TO "anon";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public."app_settings_id_seq" TO "authenticated";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public."app_settings_id_seq" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."location_invites" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."location_invites" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."location_invites" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."location_members" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."location_members" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."location_members" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."locations" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."locations" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."locations" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."settings_audit" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."settings_audit" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."settings_audit" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_bartender_members" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_bartender_members" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_bartender_members" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_bartenders" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_bartenders" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_bartenders" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_server_members" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_server_members" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_server_members" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_servers" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_servers" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_servers" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_support" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_support" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shift_support" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shifts" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shifts" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."shifts" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."sms_sends" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."sms_sends" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."sms_sends" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."staff" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."staff" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."staff" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."staff_positions" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."staff_positions" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."staff_positions" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tip_override_audit" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tip_override_audit" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tip_override_audit" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."user_roles" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."user_roles" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."user_roles" TO "service_role";
-- PUBLIC EXECUTE verified for public.accept_location_invite (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.can_admin_location (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.can_manage_location (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.create_default_app_settings (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.grant_admin_to_owner (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.handle_new_user_admin (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.handle_new_user_profile (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.has_location_role (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.has_role (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.is_location_member (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.log_settings_change (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.log_tip_override (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.set_updated_at (PostgreSQL default retained).
-- PUBLIC EXECUTE verified for public.update_updated_at_column (PostgreSQL default retained).

-- No public views exist in this snapshot.
-- Storage policies below are catalog-verbatim reference DDL; do not apply until
-- the target managed storage schema/buckets have been provisioned.
-- CREATE POLICY "Admins delete logos" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'logos'::text) AND has_role(auth.uid(), 'admin'::app_role)));
-- CREATE POLICY "Admins update logos" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'logos'::text) AND has_role(auth.uid(), 'admin'::app_role)));
-- CREATE POLICY "Admins upload logos" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'logos'::text) AND has_role(auth.uid(), 'admin'::app_role)));
-- CREATE POLICY "Anyone can view logos" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((bucket_id = 'logos'::text));
-- CREATE POLICY "Logos are publicly readable" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = 'logos'::text));
-- CREATE POLICY "Managers delete their location logo" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'logos'::text) AND can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)));
-- CREATE POLICY "Managers update their location logo" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'logos'::text) AND can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)));
-- CREATE POLICY "Managers upload their location logo" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'logos'::text) AND can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)));
