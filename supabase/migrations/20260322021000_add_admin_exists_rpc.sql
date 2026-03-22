CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE role = 'admin'
  )
$$;

GRANT EXECUTE ON FUNCTION public.admin_exists TO anon;
GRANT EXECUTE ON FUNCTION public.admin_exists TO authenticated;
