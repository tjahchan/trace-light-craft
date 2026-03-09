// Broker auto-sync edge function
// Called by cron to sync all active broker connections
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function tlRequest(
  server: string,
  method: string,
  path: string,
  accessToken?: string,
  body?: Record<string, unknown>,
  accNum?: string
) {
  const baseUrl = server.startsWith("https://") ? server : `https://${server}`;
  const url = `${baseUrl}/backend-api${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  if (accNum) headers["accNum"] = accNum;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TradeLocker API error: ${res.status} - ${errText}`);
  }
  return res.json();
}

async function refreshAccessToken(integration: any, supabaseAdmin: any) {
  const server = integration.tradelocker_server;
  const refreshToken = integration.tradelocker_refresh_token_encrypted;

  const result = await tlRequest(server, "POST", "/auth/jwt/refresh", undefined, { refreshToken });
  const newAccessToken = result.accessToken || result.access_token;
  const newRefreshToken = result.refreshToken || result.refresh_token || refreshToken;
  const expiresIn = result.expiresIn || result.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await supabaseAdmin
    .from("broker_integrations")
    .update({
      tradelocker_access_token_encrypted: newAccessToken,
      tradelocker_refresh_token_encrypted: newRefreshToken,
      tradelocker_token_expires_at: expiresAt,
    })
    .eq("id", integration.id);

  return newAccessToken;
}

async function getValidToken(integration: any, supabaseAdmin: any): Promise<string> {
  const expiresAt = integration.tradelocker_token_expires_at
    ? new Date(integration.tradelocker_token_expires_at)
    : null;

  if (!expiresAt || expiresAt.getTime() - Date.now() < 60000) {
    return await refreshAccessToken(integration, supabaseAdmin);
  }
  return integration.tradelocker_access_token_encrypted;
}

// Resolve accNum from stored value or API
function extractStoredAccNum(accountNumberMasked: string | null): string | null {
  if (!accountNumberMasked) return null;
  const match = accountNumberMasked.match(/^accnum:(\d+)\|/);
  return match ? match[1] : null;
}

async function resolveAccNum(server: string, token: string, targetAccountId: string): Promise<string> {
  const accountsResult = await tlRequest(server, "GET", "/auth/jwt/all-accounts", token);
  let allAccounts: any[] = [];
  const raw = accountsResult.accounts || accountsResult;

  if (Array.isArray(raw)) {
    allAccounts = raw;
  } else if (typeof raw === "object" && raw !== null) {
    for (const env of Object.keys(raw)) {
      const envAccounts = raw[env];
      if (Array.isArray(envAccounts)) allAccounts.push(...envAccounts);
    }
  }

  for (const acct of allAccounts) {
    if (String(acct.id || acct.accountId || "") === targetAccountId) {
      return String(acct.accNum ?? acct.acc_num ?? acct.id ?? "");
    }
  }

  if (allAccounts.length === 1) {
    return String(allAccounts[0].accNum ?? allAccounts[0].acc_num ?? allAccounts[0].id ?? "");
  }

  return targetAccountId;
}

// Convert a row array to an object using column names
function rowToObject(row: any[], columns: string[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (let i = 0; i < columns.length && i < row.length; i++) {
    obj[columns[i]] = row[i];
  }
  return obj;
}

async function fetchConfig(server: string, token: string, accNum: string): Promise<Record<string, string[]>> {
  const config = await tlRequest(server, "GET", "/trade/config", token, undefined, accNum);
  const result: Record<string, string[]> = {};
  const d = config.d || config;
  for (const key of ["ordersHistory", "positions"]) {
    if (d[key]?.columns) result[key] = d[key].columns;
  }
  return result;
}

async function resolveInstruments(
  server: string, token: string, accNum: string, instrumentIds: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (instrumentIds.length === 0) return map;
  try {
    const result = await tlRequest(server, "POST", "/trade/instruments", token, { tradableInstrumentIds: instrumentIds }, accNum);
    const instruments = result.d?.instruments || result.instruments || [];
    const cols = result.d?.columns || [];
    const nameIdx = cols.indexOf("name");
    const idIdx = cols.indexOf("tradableInstrumentId");
    if (nameIdx >= 0 && idIdx >= 0) {
      for (const row of instruments) {
        if (Array.isArray(row)) map.set(Number(row[idIdx]), String(row[nameIdx]));
      }
    } else {
      for (const inst of instruments) {
        if (inst && typeof inst === "object" && !Array.isArray(inst)) {
          map.set(Number(inst.tradableInstrumentId || inst.id), String(inst.name || inst.symbol || ""));
        }
      }
    }
  } catch (e: any) {
    console.warn("[AutoSync] Instruments fetch failed:", e.message);
  }
  return map;
}

async function syncTradeLockerAccount(
  userId: string,
  integration: any,
  brokerAccount: any,
  supabaseAdmin: any
) {
  const token = await getValidToken(integration, supabaseAdmin);
  const server = integration.tradelocker_server;
  const tlAcctId = brokerAccount.tradelocker_account_id;

  let accNum = extractStoredAccNum(brokerAccount.account_number_masked);
  if (!accNum) {
    console.log(`[AutoSync] No stored accNum for ${tlAcctId}, fetching from API...`);
    accNum = await resolveAccNum(server, token, tlAcctId);
    await supabaseAdmin
      .from("broker_accounts")
      .update({ account_number_masked: `accnum:${accNum}|${brokerAccount.account_number_masked || ""}` })
      .eq("id", brokerAccount.id);
  }

  console.log(`[AutoSync] Syncing accountId=${tlAcctId} accNum=${accNum}`);

  // Fetch config for column mappings
  const configColumns = await fetchConfig(server, token, accNum);
  const ordersCols = configColumns.ordersHistory || [];

  let imported = 0;

  const { data: job } = await supabaseAdmin
    .from("sync_jobs")
    .insert({
      user_id: userId,
      connection_id: brokerAccount.connection_id,
      account_id: brokerAccount.id,
      job_type: "auto_sync",
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  const batchId = job?.id || crypto.randomUUID();

  try {
    const ordersResult = await tlRequest(
      server, "GET", `/trade/accounts/${tlAcctId}/ordersHistory`, token, undefined, accNum
    );
    const rawOrders = ordersResult.d?.ordersHistory || ordersResult.d?.orders || [];
    const orders = Array.isArray(rawOrders) ? rawOrders : [];
    console.log(`[AutoSync] Fetched ${orders.length} historical orders`);

    // Convert columnar to objects
    let orderObjects: Record<string, any>[] = [];
    if (orders.length > 0 && Array.isArray(orders[0]) && ordersCols.length > 0) {
      orderObjects = orders.map((row: any[]) => rowToObject(row, ordersCols));
    } else if (orders.length > 0 && typeof orders[0] === "object" && !Array.isArray(orders[0])) {
      orderObjects = orders;
    }

    // Resolve instruments
    const instrumentIds = new Set<number>();
    for (const o of orderObjects) {
      const instId = Number(o.tradableInstrumentId || o.instrumentId || 0);
      if (instId > 0) instrumentIds.add(instId);
    }
    const instrumentMap = await resolveInstruments(server, token, accNum, Array.from(instrumentIds));

    const { data: momentraAccounts } = await supabaseAdmin
      .from("accounts").select("id").eq("user_id", userId).limit(1);
    const momentraAccountId = momentraAccounts?.[0]?.id;

    for (const order of orderObjects) {
      const sourceId = String(order.id || order.orderId || "");

      if (sourceId) {
        const { data: existing } = await supabaseAdmin
          .from("broker_activities_raw")
          .select("id")
          .eq("source_activity_id", sourceId)
          .eq("account_id", brokerAccount.id)
          .eq("source_provider", "tradelocker")
          .maybeSingle();
        if (existing) continue;
      }

      const status = String(order.status || "").toLowerCase();
      if (status === "cancelled" || status === "rejected" || status === "expired") continue;

      const filledQty = Math.abs(Number(order.filledQty || order.qty || 0));
      if (filledQty <= 0) continue;

      await supabaseAdmin.from("broker_activities_raw").insert({
        user_id: userId,
        account_id: brokerAccount.id,
        source_provider: "tradelocker",
        source_activity_id: sourceId,
        activity_date: order.filledAt ? new Date(Number(order.filledAt)).toISOString() : null,
        symbol: null,
        raw_payload: order,
        import_batch_id: batchId,
      });

      if (!momentraAccountId) continue;

      const instId = Number(order.tradableInstrumentId || order.instrumentId || 0);
      const symbol = instrumentMap.get(instId) || order.symbol || `INST_${instId}`;
      const side = String(order.side || "").toLowerCase().includes("buy") ? "Long" : "Short";
      const avgPrice = Number(order.avgFilledPrice || order.price || 0);
      const pnl = Number(order.pnl || order.profit || 0);
      const fees = Math.abs(Number(order.commission || order.fee || 0));
      const createdMs = Number(order.createdAt || 0);
      const filledMs = Number(order.filledAt || 0);
      const openTime = createdMs > 1000000000 ? new Date(createdMs).toISOString() : null;
      const closeTime = filledMs > 1000000000 ? new Date(filledMs).toISOString() : null;

      await supabaseAdmin.from("trades").insert({
        user_id: userId,
        account_id: momentraAccountId,
        symbol,
        side,
        quantity: filledQty,
        entry_price: avgPrice,
        exit_price: null,
        pnl: pnl - fees,
        commissions: fees,
        open_time: openTime,
        close_time: closeTime || openTime,
        status: "closed",
        tags: ["broker-import", "tradelocker", "auto-sync"],
        note: "Auto-synced from TradeLocker",
      });

      imported++;
    }

    await supabaseAdmin
      .from("sync_jobs")
      .update({
        status: imported > 0 ? "completed" : "completed_no_data",
        completed_at: new Date().toISOString(),
        activities_imported: imported,
      })
      .eq("id", job?.id);

    await supabaseAdmin
      .from("broker_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", brokerAccount.connection_id);

    console.log(`[AutoSync] Complete for user ${userId}: ${imported} imported`);
    return imported;
  } catch (err: any) {
    await supabaseAdmin
      .from("sync_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: err.message,
      })
      .eq("id", job?.id);
    console.error(`[AutoSync] Failed for user ${userId}:`, err.message);
    return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Get all active TradeLocker integrations
    const { data: integrations } = await supabaseAdmin
      .from("broker_integrations")
      .select("*")
      .eq("provider", "tradelocker")
      .eq("status", "active");

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: "No active integrations", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalImported = 0;
    let synced = 0;

    for (const integration of integrations) {
      const { data: brokerAccounts } = await supabaseAdmin
        .from("broker_accounts")
        .select("*")
        .eq("user_id", integration.user_id)
        .eq("provider", "tradelocker")
        .eq("is_selected_for_import", true);

      if (!brokerAccounts || brokerAccounts.length === 0) continue;

      for (const account of brokerAccounts) {
        const imported = await syncTradeLockerAccount(
          integration.user_id,
          integration,
          account,
          supabaseAdmin
        );
        totalImported += imported;
        synced++;
      }
    }

    return new Response(
      JSON.stringify({ message: "Auto-sync complete", synced, totalImported }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[AutoSync] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
