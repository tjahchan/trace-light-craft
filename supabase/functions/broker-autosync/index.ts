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

// CRITICAL: TradeLocker config columns can be objects like {name:"id",type:"string"}
function extractColumnNames(columns: any[]): string[] {
  return columns.map((col: any) => {
    if (typeof col === "string") return col;
    if (typeof col === "object" && col !== null) return String(col.name || col.id || col.key || "");
    return String(col);
  });
}

function rowToObject(row: any[], columns: string[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (let i = 0; i < columns.length && i < row.length; i++) obj[columns[i]] = row[i];
  return obj;
}

function parseColumnarData(data: any[], rawColumns: any[]): Record<string, any>[] {
  if (data.length === 0) return [];
  const columns = extractColumnNames(rawColumns);
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
  server: string, token: string, accNum: string, instrumentIds: number[],
  accountId?: string
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (instrumentIds.length === 0) return map;

  const acctIdForPath = accountId || accNum;

  // Fetch all instruments for the account
  const allResult = await tlRequestSafe(server, "GET", `/trade/accounts/${acctIdForPath}/instruments`, token, undefined, accNum);
  if (allResult) {
    const instruments = allResult.d?.instruments || allResult.instruments || [];
    const cols = extractColumnNames(allResult.d?.columns || allResult.columns || []);
    if (Array.isArray(instruments) && instruments.length > 0) {
      const idSet = new Set(instrumentIds);
      if (Array.isArray(instruments[0]) && cols.length > 0) {
        const nameIdx = cols.indexOf("name");
        const symIdx = cols.indexOf("symbol");
        const idIdx = cols.indexOf("tradableInstrumentId");
        const ni = nameIdx >= 0 ? nameIdx : symIdx;
        if (ni >= 0 && idIdx >= 0) {
          for (const row of instruments) {
            if (Array.isArray(row) && idSet.has(Number(row[idIdx]))) map.set(Number(row[idIdx]), String(row[ni]));
          }
        }
      } else {
        for (const inst of instruments) {
          if (inst && typeof inst === "object") {
            const instId = Number(inst.tradableInstrumentId || inst.id);
            if (idSet.has(instId)) map.set(instId, String(inst.name || inst.symbol || ""));
          }
        }
      }
    }
  }

  // Individual lookups fallback
  if (map.size < instrumentIds.length) {
    const missing = instrumentIds.filter(id => !map.has(id));
    for (const instId of missing.slice(0, 20)) {
      const r = await tlRequestSafe(server, "GET", `/trade/instruments/${instId}`, token, undefined, accNum);
      if (r) {
        const d = r.d || r;
        const name = d?.name || d?.symbol || null;
        if (name) { map.set(instId, String(name)); continue; }
      }
      const r2 = await tlRequestSafe(server, "GET", `/trade/accounts/${acctIdForPath}/instruments/${instId}`, token, undefined, accNum);
      if (r2) {
        const d = r2.d || r2;
        const name = d?.name || d?.symbol || null;
        if (name) map.set(instId, String(name));
      }
    }
  }

  return map;
}

function msToIso(ms: number): string | null {
  if (ms > 1e12) return new Date(ms).toISOString();
  if (ms > 1e9) return new Date(ms * 1000).toISOString();
  return null;
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

  // Rate limit: skip if synced less than 15 minutes ago
  if (brokerAccount.connection_id) {
    const { data: conn } = await supabaseAdmin.from("broker_connections")
      .select("last_synced_at").eq("id", brokerAccount.connection_id).maybeSingle();
    if (conn?.last_synced_at) {
      const lastSync = new Date(conn.last_synced_at).getTime();
      const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
      if (lastSync > fifteenMinAgo) {
        console.log(`[AutoSync] Skipping ${tlAcctId} — synced ${Math.round((Date.now() - lastSync) / 60000)}m ago`);
        return 0;
      }
    }
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
  if (!momentraAccountId) {
    console.log("[AutoSync] No Momentra account found, skipping");
    return 0;
  }

  try {
    let imported = 0;

    // Fetch config with column extraction fix
    let ordersCols = FALLBACK_ORDERS_COLUMNS;
    try {
      const config = await tlRequest(server, "GET", "/trade/config", token, undefined, accNum);
      const d = config.d || config;
      for (const key of ["ordersHistory", "ordersHistoryConfig"]) {
        if (d[key]?.columns?.length > 0) {
          ordersCols = extractColumnNames(d[key].columns);
          break;
        }
      }
    } catch {}

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
      const instrumentMap = await resolveInstruments(server, token, accNum, Array.from(instIds), tlAcctId);

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
        const openTime = msToIso(Number(pos.openTimestamp || pos.openedAt || pos.createdAt || pos.createdDate || 0));
        const closeTime = msToIso(Number(pos.closeTimestamp || pos.closedAt || pos.lastModifiedAt || pos.lastModified || 0));
        const grossPnl = Number(pos.pnl || 0);
        const commission = Math.abs(Number(pos.commission || 0));
        const swap = Number(pos.swap || 0);

        await supabaseAdmin.from("broker_activities_raw").insert({
          user_id: userId, account_id: brokerAccount.id, source_provider: "tradelocker",
          source_activity_id: sourceId, activity_date: closeTime || openTime,
          symbol, raw_payload: pos, import_batch_id: batchId,
        });

        if (quantity <= 0) continue;

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
      const orderObjects = parseColumnarData(orders, ordersCols);

      const instIds = new Set<number>();
      for (const o of orderObjects) { const id = Number(o.tradableInstrumentId || 0); if (id > 0) instIds.add(id); }
      const instrumentMap = await resolveInstruments(server, token, accNum, Array.from(instIds));

      // Group by parentId
      const groups = new Map<string, Record<string, any>[]>();
      const standalone: Record<string, any>[] = [];
      for (const order of orderObjects) {
        const status = String(order.status || "").toLowerCase();
        if (status === "cancelled" || status === "rejected") continue;
        const parentId = order.parentId ? String(order.parentId) : null;
        if (parentId && parentId !== "0" && parentId !== "null") {
          if (!groups.has(parentId)) groups.set(parentId, []);
          groups.get(parentId)!.push(order);
        } else {
          standalone.push(order);
        }
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
        const openTime = msToIso(Number(entry.createdAt || 0));
        const closedMs = exit ? Number(exit.lastModifiedAt || exit.createdAt || 0) : Number(entry.lastModifiedAt || 0);
        const closeTime = msToIso(closedMs);

        await supabaseAdmin.from("broker_activities_raw").insert({
          user_id: userId, account_id: brokerAccount.id, source_provider: "tradelocker",
          source_activity_id: sourceId, activity_date: closeTime || openTime,
          symbol, raw_payload: { entry, exit, legs }, import_batch_id: batchId,
        });

        if (quantity <= 0 || entryPrice <= 0) continue;

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

      // Standalone orders
      for (const order of standalone) {
        const status = String(order.status || "").toLowerCase();
        if (status === "cancelled" || status === "rejected" || status === "expired") continue;
        const filledQty = Math.abs(Number(order.filledQty || 0));
        if (filledQty <= 0) continue;

        const sourceId = `ord_${order.id || ""}`;
        if (sourceId !== "ord_") {
          const { data: existing } = await supabaseAdmin.from("broker_activities_raw").select("id")
            .eq("source_activity_id", sourceId).eq("account_id", brokerAccount.id)
            .eq("source_provider", "tradelocker").maybeSingle();
          if (existing) continue;
        }

        const instId = Number(order.tradableInstrumentId || 0);
        const symbol = instrumentMap.get(instId) || (instId > 0 ? `INST_${instId}` : "UNKNOWN");
        const sideRaw = String(order.side || "").toLowerCase();
        const side = sideRaw.includes("buy") || sideRaw === "long" ? "Long" : "Short";
        const entryPrice = Number(order.avgFilledPrice || 0);
        const openTime = msToIso(Number(order.createdAt || 0));
        const closeTime = msToIso(Number(order.lastModifiedAt || 0));
        const pnl = Number(order.pnl || 0);
        const commission = Math.abs(Number(order.commission || 0));

        await supabaseAdmin.from("broker_activities_raw").insert({
          user_id: userId, account_id: brokerAccount.id, source_provider: "tradelocker",
          source_activity_id: sourceId, activity_date: closeTime || openTime,
          symbol, raw_payload: order, import_batch_id: batchId,
        });

        if (entryPrice <= 0) continue;

        await supabaseAdmin.from("trades").insert({
          user_id: userId, account_id: momentraAccountId, symbol, side, quantity: filledQty,
          entry_price: entryPrice, pnl: pnl - commission, commissions: commission,
          open_time: openTime, close_time: closeTime || openTime, status: "closed",
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
