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
  server: string, method: string, path: string,
  accessToken?: string, body?: Record<string, unknown>, accNum?: string
) {
  const baseUrl = server.startsWith("https://") ? server : `https://${server}`;
  const url = `${baseUrl}/backend-api${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  if (accNum) headers["accNum"] = accNum;

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TradeLocker API error: ${res.status} - ${errText}`);
  }
  return res.json();
}

async function tlRequestSafe(
  server: string, method: string, path: string,
  accessToken?: string, body?: Record<string, unknown>, accNum?: string
): Promise<any | null> {
  try { return await tlRequest(server, method, path, accessToken, body, accNum); } catch { return null; }
}

async function refreshAccessToken(integration: any, supabaseAdmin: any) {
  const result = await tlRequest(integration.tradelocker_server, "POST", "/auth/jwt/refresh", undefined, {
    refreshToken: integration.tradelocker_refresh_token_encrypted,
  });
  const newAccessToken = result.accessToken || result.access_token;
  const newRefreshToken = result.refreshToken || result.refresh_token || integration.tradelocker_refresh_token_encrypted;
  const expiresAt = new Date(Date.now() + (result.expiresIn || 3600) * 1000).toISOString();

  await supabaseAdmin.from("broker_integrations").update({
    tradelocker_access_token_encrypted: newAccessToken,
    tradelocker_refresh_token_encrypted: newRefreshToken,
    tradelocker_token_expires_at: expiresAt,
  }).eq("id", integration.id);

  return newAccessToken;
}

async function getValidToken(integration: any, supabaseAdmin: any): Promise<string> {
  const expiresAt = integration.tradelocker_token_expires_at
    ? new Date(integration.tradelocker_token_expires_at) : null;
  if (!expiresAt || expiresAt.getTime() - Date.now() < 60000) {
    return await refreshAccessToken(integration, supabaseAdmin);
  }
  return integration.tradelocker_access_token_encrypted;
}

function extractStoredAccNum(masked: string | null): string | null {
  if (!masked) return null;
  const match = masked.match(/^accnum:(\d+)\|/);
  return match ? match[1] : null;
}

async function resolveAccNum(server: string, token: string, targetAccountId: string): Promise<string> {
  const accountsResult = await tlRequest(server, "GET", "/auth/jwt/all-accounts", token);
  let allAccounts: any[] = [];
  const raw = accountsResult.accounts || accountsResult;
  if (Array.isArray(raw)) allAccounts = raw;
  else if (typeof raw === "object" && raw !== null) {
    for (const env of Object.keys(raw)) {
      if (Array.isArray(raw[env])) allAccounts.push(...raw[env]);
    }
  }
  for (const acct of allAccounts) {
    if (String(acct.id || acct.accountId || "") === targetAccountId) {
      return String(acct.accNum ?? acct.acc_num ?? acct.id ?? "");
    }
  }
  if (allAccounts.length === 1) return String(allAccounts[0].accNum ?? allAccounts[0].id ?? "");
  return targetAccountId;
}

function rowToObject(row: any[], columns: string[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (let i = 0; i < columns.length && i < row.length; i++) obj[columns[i]] = row[i];
  return obj;
}

function parseColumnarData(data: any[], columns: string[]): Record<string, any>[] {
  if (data.length === 0) return [];
  if (Array.isArray(data[0]) && columns.length > 0) return data.map((r: any[]) => rowToObject(r, columns));
  if (typeof data[0] === "object" && !Array.isArray(data[0])) return data;
  return [];
}

const FALLBACK_ORDERS_COLUMNS = [
  "id", "tradableInstrumentId", "accountId", "qty", "side", "type", "status",
  "filledQty", "avgFilledPrice", "limitPrice", "stopPrice", "validity",
  "expireAt", "createdAt", "lastModifiedAt", "isFromHistory", "parentId",
  "stopLoss", "takeProfit", "trailingOffset", "commission", "pnl"
];

async function resolveInstruments(
  server: string, token: string, accNum: string, instrumentIds: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (instrumentIds.length === 0) return map;

  for (const ep of [
    { method: "POST", path: "/trade/instruments", body: { tradableInstrumentIds: instrumentIds } },
    { method: "POST", path: "/trade/accounts/instruments", body: { tradableInstrumentIds: instrumentIds } },
  ]) {
    const result = await tlRequestSafe(server, ep.method as string, ep.path, token, ep.body as any, accNum);
    if (!result) continue;
    const instruments = result.d?.instruments || result.instruments || [];
    if (!Array.isArray(instruments) || instruments.length === 0) continue;
    const cols = result.d?.columns || result.columns || [];
    if (Array.isArray(instruments[0]) && cols.length > 0) {
      const nameIdx = cols.indexOf("name");
      const symIdx = cols.indexOf("symbol");
      const idIdx = cols.indexOf("tradableInstrumentId");
      const ni = nameIdx >= 0 ? nameIdx : symIdx;
      if (ni >= 0 && idIdx >= 0) {
        for (const row of instruments) { if (Array.isArray(row)) map.set(Number(row[idIdx]), String(row[ni])); }
      }
    } else {
      for (const inst of instruments) {
        if (inst && typeof inst === "object") map.set(Number(inst.tradableInstrumentId || inst.id), String(inst.name || inst.symbol || ""));
      }
    }
    if (map.size > 0) break;
  }
  return map;
}

async function syncTradeLockerAccount(userId: string, integration: any, brokerAccount: any, supabaseAdmin: any) {
  const token = await getValidToken(integration, supabaseAdmin);
  const server = integration.tradelocker_server;
  const tlAcctId = brokerAccount.tradelocker_account_id;

  let accNum = extractStoredAccNum(brokerAccount.account_number_masked);
  if (!accNum) {
    accNum = await resolveAccNum(server, token, tlAcctId);
    await supabaseAdmin.from("broker_accounts")
      .update({ account_number_masked: `accnum:${accNum}|${brokerAccount.account_number_masked || ""}` })
      .eq("id", brokerAccount.id);
  }

  console.log(`[AutoSync] Syncing accountId=${tlAcctId} accNum=${accNum}`);

  const { data: job } = await supabaseAdmin.from("sync_jobs").insert({
    user_id: userId, connection_id: brokerAccount.connection_id,
    account_id: brokerAccount.id, job_type: "auto_sync",
    status: "running", started_at: new Date().toISOString(),
  }).select().single();

  const batchId = job?.id || crypto.randomUUID();

  const { data: momentraAccounts } = await supabaseAdmin
    .from("accounts").select("id").eq("user_id", userId).limit(1);
  const momentraAccountId = momentraAccounts?.[0]?.id;

  try {
    let imported = 0;

    // Try positionsHistory first
    let usedPositionsHistory = false;
    for (const endpoint of [
      `/trade/accounts/${tlAcctId}/positionsHistory`,
      `/trade/accounts/${tlAcctId}/positions/history`,
    ]) {
      const result = await tlRequestSafe(server, "GET", endpoint, token, undefined, accNum);
      if (!result) continue;

      const rawData = result.d?.positionsHistory || result.d?.positions || result.d?.closedPositions || [];
      const positions = Array.isArray(rawData) ? rawData : [];
      if (positions.length === 0) continue;

      usedPositionsHistory = true;
      const resCols = result.d?.columns || result.columns || [];
      const posObjects = parseColumnarData(positions, resCols);

      const instIds = new Set<number>();
      for (const p of posObjects) { const id = Number(p.tradableInstrumentId || 0); if (id > 0) instIds.add(id); }
      const instrumentMap = await resolveInstruments(server, token, accNum, Array.from(instIds));

      for (const pos of posObjects) {
        const instId = Number(pos.tradableInstrumentId || 0);
        const symbol = instrumentMap.get(instId) || pos.symbol || (instId > 0 ? `INST_${instId}` : "UNKNOWN");
        const sourceId = `pos_${pos.id || pos.positionId || ""}`;

        if (sourceId !== "pos_") {
          const { data: existing } = await supabaseAdmin.from("broker_activities_raw").select("id")
            .eq("source_activity_id", sourceId).eq("account_id", brokerAccount.id)
            .eq("source_provider", "tradelocker").maybeSingle();
          if (existing) continue;
        }

        const sideRaw = String(pos.side || "").toLowerCase();
        const side = sideRaw.includes("buy") || sideRaw === "long" ? "Long" : "Short";
        const quantity = Math.abs(Number(pos.qty || pos.filledQty || 0));
        const entryPrice = Number(pos.avgPrice || pos.avgFilledPrice || 0);
        const exitPrice = Number(pos.closePrice || pos.exitPrice || 0) || null;
        const openMs = Number(pos.openTimestamp || pos.openedAt || pos.createdAt || 0);
        const closeMs = Number(pos.closeTimestamp || pos.closedAt || pos.lastModifiedAt || 0);
        const openTime = openMs > 1e10 ? new Date(openMs).toISOString() : null;
        const closeTime = closeMs > 1e10 ? new Date(closeMs).toISOString() : null;
        const grossPnl = Number(pos.pnl || 0);
        const commission = Math.abs(Number(pos.commission || 0));
        const swap = Number(pos.swap || 0);

        await supabaseAdmin.from("broker_activities_raw").insert({
          user_id: userId, account_id: brokerAccount.id, source_provider: "tradelocker",
          source_activity_id: sourceId, activity_date: closeTime || openTime,
          symbol, raw_payload: pos, import_batch_id: batchId,
        });

        if (!momentraAccountId || quantity <= 0) continue;

        await supabaseAdmin.from("trades").insert({
          user_id: userId, account_id: momentraAccountId, symbol, side, quantity,
          entry_price: entryPrice, exit_price: exitPrice,
          sl: Number(pos.stopLoss || 0) || null, tp: Number(pos.takeProfit || 0) || null,
          pnl: grossPnl - commission + swap, commissions: commission,
          open_time: openTime, close_time: closeTime,
          status: closeTime ? "closed" : "open",
          tags: ["broker-import", "tradelocker", "auto-sync"],
          note: "Auto-synced from TradeLocker",
        });
        imported++;
      }
      break;
    }

    // Fallback to ordersHistory with grouping
    if (!usedPositionsHistory) {
      const ordersResult = await tlRequest(server, "GET", `/trade/accounts/${tlAcctId}/ordersHistory`, token, undefined, accNum);
      const rawOrders = ordersResult.d?.ordersHistory || ordersResult.d?.orders || [];
      const orders = Array.isArray(rawOrders) ? rawOrders : [];
      const orderObjects = parseColumnarData(orders, FALLBACK_ORDERS_COLUMNS);

      const instIds = new Set<number>();
      for (const o of orderObjects) { const id = Number(o.tradableInstrumentId || 0); if (id > 0) instIds.add(id); }
      const instrumentMap = await resolveInstruments(server, token, accNum, Array.from(instIds));

      // Group by parentId
      const groups = new Map<string, Record<string, any>[]>();
      for (const order of orderObjects) {
        const status = String(order.status || "").toLowerCase();
        if (status === "cancelled" || status === "rejected") continue;
        const parentId = order.parentId ? String(order.parentId) : String(order.id || "");
        if (!groups.has(parentId)) groups.set(parentId, []);
        groups.get(parentId)!.push(order);
      }

      for (const [parentId, legs] of groups) {
        const sourceId = `grp_${parentId}`;
        const { data: existing } = await supabaseAdmin.from("broker_activities_raw").select("id")
          .eq("source_activity_id", sourceId).eq("account_id", brokerAccount.id)
          .eq("source_provider", "tradelocker").maybeSingle();
        if (existing) continue;

        legs.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
        const entry = legs[0];
        const exit = legs.length > 1 ? legs[legs.length - 1] : null;
        const instId = Number(entry.tradableInstrumentId || 0);
        const symbol = instrumentMap.get(instId) || (instId > 0 ? `INST_${instId}` : "UNKNOWN");
        const sideRaw = String(entry.side || "").toLowerCase();
        const side = sideRaw.includes("buy") || sideRaw === "long" ? "Long" : "Short";
        const quantity = Math.abs(Number(entry.filledQty || entry.qty || 0));
        const entryPrice = Number(entry.avgFilledPrice || 0);
        const exitPrice = exit ? Number(exit.avgFilledPrice || 0) || null : null;
        let totalPnl = 0, totalFees = 0;
        for (const l of legs) { totalPnl += Number(l.pnl || 0); totalFees += Math.abs(Number(l.commission || 0)); }
        const openMs = Number(entry.createdAt || 0);
        const closeMs = exit ? Number(exit.lastModifiedAt || exit.createdAt || 0) : Number(entry.lastModifiedAt || 0);
        const openTime = openMs > 1e10 ? new Date(openMs).toISOString() : null;
        const closeTime = closeMs > 1e10 ? new Date(closeMs).toISOString() : null;

        await supabaseAdmin.from("broker_activities_raw").insert({
          user_id: userId, account_id: brokerAccount.id, source_provider: "tradelocker",
          source_activity_id: sourceId, activity_date: closeTime || openTime,
          symbol, raw_payload: { entry, exit, legs }, import_batch_id: batchId,
        });

        if (!momentraAccountId || quantity <= 0 || entryPrice <= 0) continue;

        await supabaseAdmin.from("trades").insert({
          user_id: userId, account_id: momentraAccountId, symbol, side, quantity,
          entry_price: entryPrice, exit_price: exitPrice,
          pnl: totalPnl - totalFees, commissions: totalFees,
          open_time: openTime, close_time: closeTime || openTime,
          status: exitPrice ? "closed" : "open",
          tags: ["broker-import", "tradelocker", "auto-sync"],
          note: "Auto-synced from TradeLocker",
        });
        imported++;
      }
    }

    await supabaseAdmin.from("sync_jobs").update({
      status: imported > 0 ? "completed" : "completed_no_data",
      completed_at: new Date().toISOString(), activities_imported: imported,
    }).eq("id", job?.id);

    await supabaseAdmin.from("broker_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", brokerAccount.connection_id);

    console.log(`[AutoSync] Complete for user ${userId}: ${imported} imported`);
    return imported;
  } catch (err: any) {
    await supabaseAdmin.from("sync_jobs").update({
      status: "failed", completed_at: new Date().toISOString(), error_message: err.message,
    }).eq("id", job?.id);
    console.error(`[AutoSync] Failed for user ${userId}:`, err.message);
    return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: integrations } = await supabaseAdmin
      .from("broker_integrations").select("*")
      .eq("provider", "tradelocker").eq("status", "active");

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: "No active integrations", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalImported = 0, synced = 0;

    for (const integration of integrations) {
      const { data: brokerAccounts } = await supabaseAdmin
        .from("broker_accounts").select("*")
        .eq("user_id", integration.user_id)
        .eq("provider", "tradelocker").eq("is_selected_for_import", true);

      if (!brokerAccounts || brokerAccounts.length === 0) continue;

      for (const account of brokerAccounts) {
        totalImported += await syncTradeLockerAccount(integration.user_id, integration, account, supabaseAdmin);
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
