
-- =============================================
-- BROKER INTEGRATION TABLES
-- =============================================

-- 1. broker_integrations: stores SnapTrade user identity per Momentra user
CREATE TABLE public.broker_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'snaptrade',
  snaptrade_user_id text,
  snaptrade_user_secret_encrypted text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. broker_connections: each broker connection (e.g. TD Ameritrade, Interactive Brokers)
CREATE TABLE public.broker_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.broker_integrations(id) ON DELETE CASCADE,
  snaptrade_connection_id text,
  broker_name text,
  connection_status text NOT NULL DEFAULT 'connected',
  disabled boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. broker_accounts: individual brokerage accounts under a connection
CREATE TABLE public.broker_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  snaptrade_account_id text,
  broker_name text,
  account_name text,
  account_type text,
  account_number_masked text,
  currency text DEFAULT 'USD',
  is_selected_for_import boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. broker_activities_raw: raw imported activities preserving source-of-truth payload
CREATE TABLE public.broker_activities_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.broker_accounts(id) ON DELETE CASCADE,
  source_provider text NOT NULL DEFAULT 'snaptrade',
  source_activity_id text,
  activity_date timestamptz,
  symbol text,
  raw_payload jsonb,
  import_batch_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for deduplication
CREATE UNIQUE INDEX broker_activities_raw_dedup 
  ON public.broker_activities_raw (source_provider, source_activity_id, account_id) 
  WHERE source_activity_id IS NOT NULL;

-- 5. sync_jobs: track import/sync operations
CREATE TABLE public.sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid REFERENCES public.broker_connections(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.broker_accounts(id) ON DELETE SET NULL,
  job_type text NOT NULL DEFAULT 'manual_sync',
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  activities_imported integer DEFAULT 0,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.broker_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_activities_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- broker_integrations policies
CREATE POLICY "Users can view own integrations" ON public.broker_integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own integrations" ON public.broker_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own integrations" ON public.broker_integrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own integrations" ON public.broker_integrations FOR DELETE USING (auth.uid() = user_id);

-- broker_connections policies
CREATE POLICY "Users can view own connections" ON public.broker_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own connections" ON public.broker_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own connections" ON public.broker_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own connections" ON public.broker_connections FOR DELETE USING (auth.uid() = user_id);

-- broker_accounts policies
CREATE POLICY "Users can view own broker accounts" ON public.broker_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own broker accounts" ON public.broker_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own broker accounts" ON public.broker_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own broker accounts" ON public.broker_accounts FOR DELETE USING (auth.uid() = user_id);

-- broker_activities_raw policies
CREATE POLICY "Users can view own activities" ON public.broker_activities_raw FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activities" ON public.broker_activities_raw FOR INSERT WITH CHECK (auth.uid() = user_id);

-- sync_jobs policies
CREATE POLICY "Users can view own sync jobs" ON public.sync_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sync jobs" ON public.sync_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sync jobs" ON public.sync_jobs FOR UPDATE USING (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_broker_integrations_updated_at BEFORE UPDATE ON public.broker_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_broker_connections_updated_at BEFORE UPDATE ON public.broker_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_broker_accounts_updated_at BEFORE UPDATE ON public.broker_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
