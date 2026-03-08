
-- Balance history table for tracking equity over time
CREATE TABLE public.balance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  equity numeric NOT NULL DEFAULT 0,
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'trade',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_balance_history_account_date ON public.balance_history(account_id, created_at);
CREATE INDEX idx_balance_history_user ON public.balance_history(user_id);

-- Enable RLS
ALTER TABLE public.balance_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own balance history" ON public.balance_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own balance history" ON public.balance_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own balance history" ON public.balance_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Referral signups tracking table
CREATE TABLE public.referral_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  new_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(new_user_id)
);

ALTER TABLE public.referral_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON public.referral_signups
  FOR SELECT TO authenticated USING (auth.uid() = referrer_user_id);

CREATE POLICY "Users can insert referrals" ON public.referral_signups
  FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime for balance_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.balance_history;
