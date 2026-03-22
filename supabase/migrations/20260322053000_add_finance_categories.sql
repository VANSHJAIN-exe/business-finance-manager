ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'adjustment';

UPDATE public.finance_transactions
SET category = CASE
  WHEN transaction_type = 'debit' THEN 'payment'
  WHEN notes ILIKE 'Extra payment%' THEN 'bonus'
  WHEN notes ILIKE 'Payment released%' THEN 'earning'
  WHEN transaction_type = 'credit' THEN 'earning'
  ELSE 'adjustment'
END
WHERE category = 'adjustment';
