
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS use_net_sales boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sales_tax_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cc_fee_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cc_fee_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manager_exclusion_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false;
