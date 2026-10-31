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