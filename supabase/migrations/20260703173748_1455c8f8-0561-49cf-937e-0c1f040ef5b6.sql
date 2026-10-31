
ALTER TABLE public.shift_servers
  ADD COLUMN IF NOT EXISTS bar_tip_override numeric,
  ADD COLUMN IF NOT EXISTS rb_tip_override numeric;
ALTER TABLE public.shift_bartenders
  ADD COLUMN IF NOT EXISTS rb_tip_override numeric;
