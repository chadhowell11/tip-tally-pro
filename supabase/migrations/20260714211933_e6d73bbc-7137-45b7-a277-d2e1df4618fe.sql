
-- Allow a bartender entry to be a shared cash-out for multiple bartenders.
ALTER TABLE public.shift_bartenders
  ADD COLUMN IF NOT EXISTS split_mode text NOT NULL DEFAULT 'single'
    CHECK (split_mode IN ('single','equal','hours'));
ALTER TABLE public.shift_bartenders
  ALTER COLUMN staff_id DROP NOT NULL;

CREATE TABLE public.shift_bartender_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_bartender_id uuid NOT NULL REFERENCES public.shift_bartenders(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  hours_worked numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_bartender_id, staff_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_bartender_members TO authenticated;
GRANT ALL ON public.shift_bartender_members TO service_role;

ALTER TABLE public.shift_bartender_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read shift_bartender_members"
  ON public.shift_bartender_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shift_bartenders sb
    JOIN public.shifts s ON s.id = sb.shift_id
    WHERE sb.id = shift_bartender_members.shift_bartender_id
      AND public.is_location_member(auth.uid(), s.location_id)
  ));

CREATE POLICY "Members write shift_bartender_members"
  ON public.shift_bartender_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.shift_bartenders sb
    JOIN public.shifts s ON s.id = sb.shift_id
    WHERE sb.id = shift_bartender_members.shift_bartender_id
      AND public.is_location_member(auth.uid(), s.location_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shift_bartenders sb
    JOIN public.shifts s ON s.id = sb.shift_id
    WHERE sb.id = shift_bartender_members.shift_bartender_id
      AND public.is_location_member(auth.uid(), s.location_id)
  ));

CREATE TRIGGER set_shift_bartender_members_updated_at
  BEFORE UPDATE ON public.shift_bartender_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
