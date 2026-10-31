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