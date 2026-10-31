ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS rb_basis text NOT NULL DEFAULT 'tips'
    CHECK (rb_basis IN ('tips','sales'));

ALTER TABLE public.shift_servers
  ADD COLUMN IF NOT EXISTS total_sales numeric NOT NULL DEFAULT 0;

ALTER TABLE public.shift_bartenders
  ADD COLUMN IF NOT EXISTS total_sales numeric NOT NULL DEFAULT 0;