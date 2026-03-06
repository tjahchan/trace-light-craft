
-- Create user_plans table
CREATE TABLE public.user_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free',
  csv_imports_this_month integer NOT NULL DEFAULT 0,
  ai_requests_this_month integer NOT NULL DEFAULT 0,
  current_billing_cycle_start timestamp with time zone NOT NULL DEFAULT date_trunc('month', now()),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own plan" ON public.user_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own plan" ON public.user_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plan" ON public.user_plans FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create plan row for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_plans (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Function to increment usage and check limits (returns true if allowed)
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id uuid, p_type text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan user_plans%ROWTYPE;
  v_limit integer;
  v_current integer;
BEGIN
  SELECT * INTO v_plan FROM user_plans WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO user_plans (user_id) VALUES (p_user_id) RETURNING * INTO v_plan;
  END IF;

  -- Reset counters if new month
  IF date_trunc('month', now()) > date_trunc('month', v_plan.current_billing_cycle_start) THEN
    UPDATE user_plans SET 
      csv_imports_this_month = 0,
      ai_requests_this_month = 0,
      current_billing_cycle_start = date_trunc('month', now())
    WHERE user_id = p_user_id
    RETURNING * INTO v_plan;
  END IF;

  -- Pro users have no limits
  IF v_plan.plan = 'pro' THEN
    IF p_type = 'csv' THEN
      UPDATE user_plans SET csv_imports_this_month = csv_imports_this_month + 1 WHERE user_id = p_user_id;
    ELSIF p_type = 'ai' THEN
      UPDATE user_plans SET ai_requests_this_month = ai_requests_this_month + 1 WHERE user_id = p_user_id;
    END IF;
    RETURN json_build_object('allowed', true, 'plan', 'pro');
  END IF;

  -- Free user limits
  IF p_type = 'csv' THEN
    v_limit := 3;
    v_current := v_plan.csv_imports_this_month;
  ELSIF p_type = 'ai' THEN
    v_limit := 3;
    v_current := v_plan.ai_requests_this_month;
  ELSE
    RETURN json_build_object('allowed', false, 'error', 'invalid type');
  END IF;

  IF v_current >= v_limit THEN
    RETURN json_build_object('allowed', false, 'plan', 'free', 'used', v_current, 'limit', v_limit);
  END IF;

  -- Increment
  IF p_type = 'csv' THEN
    UPDATE user_plans SET csv_imports_this_month = csv_imports_this_month + 1 WHERE user_id = p_user_id;
  ELSIF p_type = 'ai' THEN
    UPDATE user_plans SET ai_requests_this_month = ai_requests_this_month + 1 WHERE user_id = p_user_id;
  END IF;

  RETURN json_build_object('allowed', true, 'plan', 'free', 'used', v_current + 1, 'limit', v_limit);
END;
$$;
