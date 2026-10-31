ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS singleton;

DROP POLICY IF EXISTS "Members view their locations" ON public.locations;
CREATE POLICY "Members view their locations"
ON public.locations FOR SELECT TO authenticated
USING (public.is_location_member(auth.uid(), id) OR owner_user_id = auth.uid());

DELETE FROM public.locations WHERE name IN ('RLS Probe','RLS Probe2');