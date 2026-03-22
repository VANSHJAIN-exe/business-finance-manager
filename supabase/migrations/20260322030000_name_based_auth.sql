ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_name text;

UPDATE public.profiles
SET login_name = COALESCE(
  login_name,
  trim(full_name)
)
WHERE login_name IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN login_name SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_login_name_lower_key
  ON public.profiles (lower(login_name));

CREATE OR REPLACE FUNCTION public.get_auth_email_by_login_name(_login_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE lower(login_name) = lower(trim(_login_name))
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_email_by_login_name TO anon;
GRANT EXECUTE ON FUNCTION public.get_auth_email_by_login_name TO authenticated;
