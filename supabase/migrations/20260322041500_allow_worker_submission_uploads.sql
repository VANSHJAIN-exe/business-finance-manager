DROP POLICY IF EXISTS "Admins can manage work images insert" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update work images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete work images" ON storage.objects;

CREATE POLICY "Admins and workers can insert work images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-images' AND (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'worker')
    )
  );

CREATE POLICY "Admins and workers can update work images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'work-images' AND (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'worker')
    )
  );

CREATE POLICY "Admins can delete work images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'work-images' AND public.has_role(auth.uid(), 'admin'));
