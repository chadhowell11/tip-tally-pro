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