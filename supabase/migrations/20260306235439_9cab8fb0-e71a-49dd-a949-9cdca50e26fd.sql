
-- Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can read their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS: only admins can manage roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add billing fields to user_plans
ALTER TABLE public.user_plans
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS billing_cycle_end timestamp with time zone;

-- Add last_active_at to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_active_at timestamp with time zone DEFAULT now();

-- Trigger: assign 'user' role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Admin function to get all users data (security definer)
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_active_at timestamptz,
  plan text,
  subscription_status text,
  stripe_customer_id text,
  current_streak int,
  best_streak int,
  ai_requests_this_month int,
  csv_imports_this_month int,
  sample_data_enabled boolean,
  has_seen_tour boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.email,
    p.display_name,
    p.created_at,
    p.last_active_at,
    COALESCE(up.plan, 'free'),
    COALESCE(up.subscription_status, 'none'),
    up.stripe_customer_id,
    COALESCE(us.current_streak, 0),
    COALESCE(us.best_streak, 0),
    COALESCE(up.ai_requests_this_month, 0),
    COALESCE(up.csv_imports_this_month, 0),
    p.sample_data_enabled,
    p.has_seen_tour
  FROM profiles p
  LEFT JOIN user_plans up ON up.user_id = p.user_id
  LEFT JOIN user_streaks us ON us.user_id = p.user_id;
END;
$$;

-- Admin function to get platform stats
CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM profiles),
    'free_users', (SELECT count(*) FROM user_plans WHERE plan = 'free' OR plan IS NULL),
    'pro_users', (SELECT count(*) FROM user_plans WHERE plan = 'pro'),
    'active_users_30d', (SELECT count(*) FROM profiles WHERE last_active_at > now() - interval '30 days'),
    'total_trades', (SELECT count(*) FROM trades),
    'total_ai_requests', (SELECT COALESCE(sum(ai_requests_this_month), 0) FROM user_plans),
    'broker_connected_users', (SELECT count(DISTINCT user_id) FROM broker_connections WHERE connection_status = 'connected')
  ) INTO result;

  RETURN result;
END;
$$;

-- Admin function to update user plan manually
CREATE OR REPLACE FUNCTION public.admin_update_user_plan(
  p_target_user_id uuid,
  p_plan text DEFAULT NULL,
  p_reset_ai boolean DEFAULT false,
  p_reset_csv boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_plan IS NOT NULL THEN
    UPDATE user_plans SET plan = p_plan, updated_at = now() WHERE user_id = p_target_user_id;
  END IF;

  IF p_reset_ai THEN
    UPDATE user_plans SET ai_requests_this_month = 0, updated_at = now() WHERE user_id = p_target_user_id;
  END IF;

  IF p_reset_csv THEN
    UPDATE user_plans SET csv_imports_this_month = 0, updated_at = now() WHERE user_id = p_target_user_id;
  END IF;
END;
$$;
