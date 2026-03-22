
CREATE TYPE public.worker_type AS ENUM ('dyer', 'normal');

ALTER TABLE public.profiles ADD COLUMN password_plain text;
ALTER TABLE public.profiles ADD COLUMN worker_type public.worker_type;
ALTER TABLE public.profiles ADD COLUMN avatar_url text;

CREATE TABLE public.work_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url text,
  num_pieces integer NOT NULL DEFAULT 0,
  price_per_piece numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  num_meters numeric(10,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access work_assignments" ON public.work_assignments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Workers view own assignments" ON public.work_assignments
  FOR SELECT TO authenticated USING (
    worker_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.get_email_by_name(_name text, _role public.app_role DEFAULT 'worker')
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE full_name = _name AND role = _role LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_name TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_name TO authenticated;

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('work-images', 'work-images', true);

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Admins can manage avatars insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view work images" ON storage.objects FOR SELECT USING (bucket_id = 'work-images');
CREATE POLICY "Admins can manage work images insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'work-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update work images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'work-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete work images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'work-images' AND public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_work_assignments_updated_at
  BEFORE UPDATE ON public.work_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
