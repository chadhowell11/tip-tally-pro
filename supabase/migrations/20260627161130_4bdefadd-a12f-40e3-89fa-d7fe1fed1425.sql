
CREATE POLICY "Anyone can view logos" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'logos');
CREATE POLICY "Admins upload logos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update logos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete logos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));
