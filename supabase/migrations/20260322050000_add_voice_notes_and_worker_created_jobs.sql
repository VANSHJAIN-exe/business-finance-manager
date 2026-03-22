ALTER TABLE public.work_assignments
  ADD COLUMN IF NOT EXISTS assignment_note_audio_url text,
  ADD COLUMN IF NOT EXISTS submission_voice_note_url text,
  ADD COLUMN IF NOT EXISTS employee_review_notes text,
  ADD COLUMN IF NOT EXISTS employee_review_voice_note_url text,
  ADD COLUMN IF NOT EXISTS admin_review_notes text,
  ADD COLUMN IF NOT EXISTS admin_review_voice_note_url text,
  ADD COLUMN IF NOT EXISTS worker_created boolean NOT NULL DEFAULT false;

ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS audio_note_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view voice notes" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'voice-notes');

CREATE POLICY "Authenticated can insert voice notes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes' AND (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'employee') OR
      public.has_role(auth.uid(), 'worker')
    )
  );

CREATE POLICY "Authenticated can update voice notes" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'voice-notes' AND (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'employee') OR
      public.has_role(auth.uid(), 'worker')
    )
  );

CREATE POLICY "Admins can delete voice notes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'voice-notes' AND public.has_role(auth.uid(), 'admin'));
