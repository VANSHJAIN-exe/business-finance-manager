
-- Add task_name and submission fields to work_assignments
ALTER TABLE public.work_assignments 
  ADD COLUMN IF NOT EXISTS task_name text NOT NULL DEFAULT 'Task',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'assigned',
  ADD COLUMN IF NOT EXISTS submission_image_url text,
  ADD COLUMN IF NOT EXISTS submission_notes text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_status text;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id IN (
    SELECT p.user_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ) OR user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id IN (
    SELECT p.user_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ) OR user_id = auth.uid());

CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins full access notifications" ON public.notifications
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Allow employees to read worker profiles
CREATE POLICY "Employees can read worker profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'employee') AND role = 'worker'
  );

-- Allow employees to read work assignments
CREATE POLICY "Employees view all assignments" ON public.work_assignments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'employee'));

-- Allow employees to update assignments (for review)
CREATE POLICY "Employees can review assignments" ON public.work_assignments
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'employee'));

-- Allow workers to update own assignments (for submission)
CREATE POLICY "Workers can submit own assignments" ON public.work_assignments
  FOR UPDATE TO authenticated USING (
    worker_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_assignments;
