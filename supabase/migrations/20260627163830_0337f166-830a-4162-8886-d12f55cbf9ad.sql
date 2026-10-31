ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'hostess';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS weight_hostess NUMERIC(4,2) NOT NULL DEFAULT 0.5;