CREATE POLICY "Workers can create own assignments" ON public.work_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    worker_id IN (
      SELECT id
      FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'worker'
    )
  );
