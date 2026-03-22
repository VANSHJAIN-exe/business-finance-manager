ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_balance numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.work_assignments
  ADD COLUMN IF NOT EXISTS admin_review_status text,
  ADD COLUMN IF NOT EXISTS admin_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS payout_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.work_assignments(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  transaction_type text NOT NULL DEFAULT 'credit',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access finance_transactions"
ON public.finance_transactions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Workers can read own finance transactions"
ON public.finance_transactions
FOR SELECT TO authenticated
USING (
  worker_profile_id IN (
    SELECT id
    FROM public.profiles
    WHERE user_id = auth.uid()
  )
);
