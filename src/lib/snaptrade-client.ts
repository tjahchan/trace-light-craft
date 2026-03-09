// Client-side service layer for broker operations
// All sensitive API calls are proxied through edge functions
import { supabase } from "@/integrations/supabase/client";
import { syncTradeLockerAccount } from "@/lib/tradelocker-client";

async function invokeSnapTrade<T = unknown>(action: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("snaptrade", {
    body: { action, ...body },
  });

  if (error) {
    console.error(`[SnapTrade Client] ${action} failed:`, error);
    throw new Error(error.message || `SnapTrade ${action} failed`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}

export interface BrokerConnection {
  id: string;
  broker_name: string;
  connection_status: string;
  disabled: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface BrokerAccount {
  id: string;
  broker_name: string;
  account_name: string;
  account_type: string | null;
  account_number_masked: string | null;
  currency: string;
  is_selected_for_import: boolean;
  status: string;
  connection_id: string;
}

export interface SyncResult {
  success: boolean;
  imported: number;
  job_id: string;
}

// Register or fetch SnapTrade user identity
export async function registerSnapTradeUser() {
  return invokeSnapTrade<{
    snaptrade_user_id: string;
    integration_id: string;
    already_exists: boolean;
  }>("register");
}

// Generate the broker connection portal URL
export async function generateConnectUrl(redirectUri: string) {
  return invokeSnapTrade<{ redirect_url: string }>("connect_url", { redirect_uri: redirectUri });
}

// Fetch all broker connections for the user
export async function listConnections() {
  return invokeSnapTrade<{ connections: BrokerConnection[] }>("list_connections");
}

// Fetch all brokerage accounts
export async function listAccounts() {
  return invokeSnapTrade<{ accounts: BrokerAccount[] }>("list_accounts");
}

// Mark accounts as selected for import
export async function selectAccounts(accountIds: string[]) {
  return invokeSnapTrade<{ selected: number }>("select_accounts", { account_ids: accountIds });
}

// Trigger a sync/import for an account (auto-routes TradeLocker accounts)
export async function syncAccount(accountId: string, jobType = "manual_sync") {
  // Check if this is a TradeLocker account by looking at cached accounts or querying
  const { data: acct } = await supabase
    .from("broker_accounts")
    .select("provider")
    .eq("id", accountId)
    .single();

  if (acct?.provider === "tradelocker") {
    return syncTradeLockerAccount(accountId, jobType);
  }

  return invokeSnapTrade<SyncResult>("sync", { account_id: accountId, job_type: jobType });
}

// Disconnect a broker connection
export async function disconnectConnection(connectionId: string) {
  return invokeSnapTrade<{ success: boolean }>("disconnect", { connection_id: connectionId });
}

// Fetch sync jobs from database (direct client query, RLS-protected)
export async function getSyncJobs(limit = 20) {
  const { data, error } = await supabase
    .from("sync_jobs" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as any[];
}

// Check if user has an existing integration
export async function hasExistingIntegration() {
  const { data } = await supabase
    .from("broker_integrations" as any)
    .select("id, status")
    .eq("provider", "snaptrade")
    .maybeSingle();

  return !!data;
}
