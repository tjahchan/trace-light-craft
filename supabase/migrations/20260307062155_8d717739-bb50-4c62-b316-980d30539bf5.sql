
-- Add referral tracking columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER NOT NULL DEFAULT 0;

-- Set referral_code = username where username exists
UPDATE public.profiles SET referral_code = username WHERE username IS NOT NULL AND referral_code IS NULL;
