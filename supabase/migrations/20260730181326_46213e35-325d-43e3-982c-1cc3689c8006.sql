CREATE POLICY "Owner can bootstrap own membership"
ON public.location_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'owner'::location_role
  AND EXISTS (SELECT 1 FROM public.locations l WHERE l.id = location_members.location_id AND l.owner_user_id = auth.uid())
);

DELETE FROM public.locations WHERE name LIKE 'RLS Probe%';