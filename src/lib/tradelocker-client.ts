// Client-side service layer for TradeLocker operations
import { supabase } from "@/integrations/supabase/client";

async function invokeTradeLocker<T = unknown>(action: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("tradelocker", {
    body: { action, ...body },
  });

  if (error) {
    console.error(`[TradeLocker Client] ${action} failed:`, error);
    throw new Error(error.message || `TradeLocker ${action} failed`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}

export interface TLAccount {
  id: string;
  broker_name: string;
  account_name: string;
  account_type: string | null;
  account_number_masked: string | null;
  currency: string;
  is_selected_for_import: boolean;
  connection_id: string;
  tradelocker_account_id: string | null;
}

export interface TLSyncResult {
  success: boolean;
  imported: number;
  job_id: string;
}

export async function authenticateTradeLocker(environment: string, serverName: string, email: string, password: string) {
  return invokeTradeLocker<{ success: boolean; integration_id: string; connection_id: string }>(
    "authenticate",
    { environment, server_name: serverName, email, password }
  );
}

export async function listTradeLockerAccounts() {
  return invokeTradeLocker<{ accounts: TLAccount[] }>("list_accounts");
}

export async function selectTradeLockerAccounts(accountIds: string[]) {
  return invokeTradeLocker<{ selected: number }>("select_accounts", { account_ids: accountIds });
}

export async function syncTradeLockerAccount(accountId: string, jobType = "manual_sync") {
  return invokeTradeLocker<TLSyncResult>("sync", { account_id: accountId, job_type: jobType });
}

export async function forceResyncTradeLocker(accountId: string) {
  return invokeTradeLocker<TLSyncResult>("force_resync", { account_id: accountId });
}

export async function disconnectTradeLocker(connectionId: string) {
  return invokeTradeLocker<{ success: boolean }>("disconnect", { connection_id: connectionId });
}
