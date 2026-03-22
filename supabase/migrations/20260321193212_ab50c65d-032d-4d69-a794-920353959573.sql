
-- Fix the overly permissive insert policy
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Admins and system can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'worker')
  );
