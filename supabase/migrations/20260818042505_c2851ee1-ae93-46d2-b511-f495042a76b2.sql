UPDATE public.shift_support ss
SET role = COALESCE(
  (SELECT sp.position FROM public.staff_positions sp
   WHERE sp.staff_id = ss.staff_id
     AND sp.position IN ('runner','busser','bar_back','hostess')
   ORDER BY CASE sp.position WHEN 'runner' THEN 1 WHEN 'busser' THEN 2 WHEN 'bar_back' THEN 3 ELSE 4 END
   LIMIT 1),
  'runner'::staff_role)
WHERE ss.role IS NULL;