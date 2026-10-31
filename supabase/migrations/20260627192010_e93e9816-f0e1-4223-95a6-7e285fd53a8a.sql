CREATE TABLE public.staff_positions (
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  position staff_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, position)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_positions TO authenticated;
GRANT ALL ON public.staff_positions TO service_role;

ALTER TABLE public.staff_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read staff_positions" ON public.staff_positions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_positions.staff_id AND is_location_member(auth.uid(), s.location_id)));

CREATE POLICY "Managers write staff_positions" ON public.staff_positions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_positions.staff_id AND can_manage_location(auth.uid(), s.location_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_positions.staff_id AND can_manage_location(auth.uid(), s.location_id)));

CREATE INDEX staff_positions_position_idx ON public.staff_positions(position);

-- Backfill from existing staff.role
INSERT INTO public.staff_positions (staff_id, position)
SELECT id, role FROM public.staff
ON CONFLICT DO NOTHING;