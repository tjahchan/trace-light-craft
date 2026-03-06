ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS initial_balance numeric NOT NULL DEFAULT 0;
UPDATE public.accounts SET initial_balance = balance WHERE initial_balance = 0 AND balance > 0;