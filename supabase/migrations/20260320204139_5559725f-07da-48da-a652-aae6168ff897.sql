
-- Add options-specific columns to the trades table
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS trade_type text NOT NULL DEFAULT 'standard';
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS option_type text; -- 'call' or 'put'
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS position_direction text; -- 'long' or 'short'
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS strike_price numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS expiration_date date;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS contract_multiplier integer DEFAULT 100;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS num_contracts integer;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS entry_premium numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS exit_premium numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS current_premium numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS underlying_price_entry numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS underlying_price_exit numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS underlying_price_current numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS iv_entry numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS iv_exit numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS delta numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS gamma numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS theta numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS vega numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS rho numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS option_status text DEFAULT 'open'; -- open, closed, expired, assigned, exercised
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS capital_at_risk numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS strategy_label text DEFAULT 'Single Leg';
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS entry_fees numeric DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS exit_fees numeric DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS underlying_ticker text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS close_type text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS directional_thesis text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS entry_reason text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS exit_reason text;
