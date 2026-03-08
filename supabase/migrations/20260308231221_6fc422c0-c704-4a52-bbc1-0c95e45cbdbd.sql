
-- Fix the overly permissive INSERT policy on referral_signups
DROP POLICY "Users can insert referrals" ON public.referral_signups;

CREATE POLICY "Users can insert referrals" ON public.referral_signups
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = new_user_id);
