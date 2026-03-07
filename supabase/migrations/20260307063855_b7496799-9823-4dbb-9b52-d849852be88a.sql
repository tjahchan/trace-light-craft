
-- Add TradeLocker-specific columns to broker_integrations
ALTER TABLE public.broker_integrations
  ADD COLUMN IF NOT EXISTS tradelocker_server text,
  ADD COLUMN IF NOT EXISTS tradelocker_access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS tradelocker_refresh_token_encrypted text,
  ADD COLUMN IF NOT EXISTS tradelocker_token_expires_at timestamptz;

-- Add provider column to broker_connections if not distinguishing already
ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'snaptrade';

-- Add provider to broker_accounts
ALTER TABLE public.broker_accounts
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'snaptrade';

-- Add tradelocker_account_id to broker_accounts
ALTER TABLE public.broker_accounts
  ADD COLUMN IF NOT EXISTS tradelocker_account_id text;
