// TradeLocker broker integration edge function
// Handles auth, account discovery, and trade history sync
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

// ---- TradeLocker API helpers ----

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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  if (accNum) {
    headers["accNum"] = accNum;
  }

  console.log(`[TL] ${method} ${path} (accNum: ${accNum || "none"})`);

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[TL] ${method} ${path} failed: ${res.status} ${errText.slice(0, 200)}`);
    throw new Error(`TradeLocker API error: ${res.status} - ${errText}`);
  }

  return res.json();
}

// Try a request, return null on failure instead of throwing
async function tlRequestSafe(
  server: string,
  method: string,
  path: string,
  accessToken?: string,
  body?: Record<string, unknown>,
  accNum?: string
): Promise<any | null> {
  try {
    return await tlRequest(server, method, path, accessToken, body, accNum);
  } catch {
    return null;
  }
}

// Helper: resolve accNum for a given accountId
async function resolveAccNum(
  server: string,
  token: string,
  targetAccountId: string
): Promise<string> {
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
    const acctId = String(acct.id || acct.accountId || "");
    const accNum = String(acct.accNum ?? acct.acc_num ?? "");
    if (acctId === targetAccountId && accNum) return accNum;
  }

  if (allAccounts.length === 1) {
    const only = allAccounts[0];
    return String(only.accNum ?? only.acc_num ?? only.id ?? "");
  }

  return targetAccountId;
}

// ---- Columnar data helpers ----

function rowToObject(row: any[], columns: string[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (let i = 0; i < columns.length && i < row.length; i++) {
    obj[columns[i]] = row[i];
  }
  return obj;
}

function parseColumnarData(data: any[], columns: string[]): Record<string, any>[] {
  if (data.length === 0) return [];
  if (Array.isArray(data[0]) && columns.length > 0) {
    return data.map((row: any[]) => rowToObject(row, columns));
  }
  if (typeof data[0] === "object" && !Array.isArray(data[0])) {
    return data;
  }
  return [];
}

// ---- Instrument resolution ----

async function resolveInstruments(
  server: string,
  token: string,
  accNum: string,
  instrumentIds: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (instrumentIds.length === 0) return map;

  // Try multiple endpoint patterns
  const endpoints = [
    { method: "POST", path: "/trade/instruments", body: { tradableInstrumentIds: instrumentIds } },
    { method: "POST", path: "/trade/accounts/instruments", body: { tradableInstrumentIds: instrumentIds } },
  ];

  for (const ep of endpoints) {
    const result = await tlRequestSafe(server, ep.method, ep.path, token, ep.body, accNum);
    if (!result) continue;

    const instruments = result.d?.instruments || result.instruments || [];
    if (!Array.isArray(instruments) || instruments.length === 0) continue;

    const cols = result.d?.columns || result.columns || [];

    if (Array.isArray(instruments[0]) && cols.length > 0) {
      const nameIdx = cols.indexOf("name");
      const symIdx = cols.indexOf("symbol");
      const idIdx = cols.indexOf("tradableInstrumentId");
      const resolvedNameIdx = nameIdx >= 0 ? nameIdx : symIdx;
      if (resolvedNameIdx >= 0 && idIdx >= 0) {
        for (const row of instruments) {
          if (Array.isArray(row)) {
            map.set(Number(row[idIdx]), String(row[resolvedNameIdx]));
          }
        }
      }
    } else {
      for (const inst of instruments) {
        if (inst && typeof inst === "object" && !Array.isArray(inst)) {
          map.set(
            Number(inst.tradableInstrumentId || inst.id),
            String(inst.name || inst.symbol || "")
          );
        }
      }
    }

    if (map.size > 0) break;
  }

  // Last resort: try fetching each instrument individually via search
  if (map.size === 0 && instrumentIds.length > 0) {
    console.log("[TL] Bulk instrument resolution failed, trying individual lookups...");
    for (const instId of instrumentIds.slice(0, 20)) { // limit to avoid rate limits
      const searchResult = await tlRequestSafe(
        server, "GET",
        `/trade/accounts/${accNum}/instruments/${instId}`,
        token, undefined, accNum
      );
      if (searchResult) {
        const d = searchResult.d || searchResult;
        const name = d?.name || d?.symbol || null;
        if (name) map.set(instId, String(name));
      }
    }
  }

  console.log(`[TL] Resolved ${map.size}/${instrumentIds.length} instrument names`);
  for (const [id, name] of map) {
    console.log(`[TL]   ${id} → ${name}`);
  }
  return map;
}

// ---- Normalization layer ----

interface NormalizedTrade {
  symbol: string;
  side: "Long" | "Short";
  quantity: number;
  entry_price: number;
  exit_price: number | null;
  sl: number | null;
  tp: number | null;
  open_time: string | null;
  close_time: string | null;
  pnl: number;
  commissions: number;
  swap: number;
  close_type: string | null;
  broker_order_id: string | null;
  broker_position_id: string | null;
  status: "open" | "closed";
  raw: Record<string, any>;
}

function normalizePositionHistory(
  pos: Record<string, any>,
  instrumentMap: Map<number, string>
): NormalizedTrade | null {
  // Position history has: id, tradableInstrumentId, side, qty, avgPrice (entry),
  // closePrice (exit), stopLoss, takeProfit, pnl, commission, swap, openTimestamp, closeTimestamp, etc.
  const instId = Number(pos.tradableInstrumentId || pos.instrumentId || 0);
  const symbol = instrumentMap.get(instId) || pos.symbol || pos.instrument || (instId > 0 ? `INST_${instId}` : "UNKNOWN");

  const sideRaw = String(pos.side || "").toLowerCase();
  const side: "Long" | "Short" = sideRaw.includes("buy") || sideRaw === "long" ? "Long" : "Short";

  const quantity = Math.abs(Number(pos.qty || pos.quantity || pos.filledQty || 0));
  if (quantity <= 0) return null;

  const entryPrice = Number(pos.avgPrice || pos.avgFilledPrice || pos.entryPrice || pos.openPrice || 0);
  const exitPrice = Number(pos.closePrice || pos.exitPrice || pos.avgClosePrice || 0) || null;

  const sl = Number(pos.stopLoss || pos.sl || 0) || null;
  const tp = Number(pos.takeProfit || pos.tp || 0) || null;

  // Timestamps - TradeLocker uses milliseconds
  const openMs = Number(pos.openTimestamp || pos.openedAt || pos.createdAt || 0);
  const closeMs = Number(pos.closeTimestamp || pos.closedAt || pos.lastModifiedAt || 0);
  const openTime = openMs > 1e10 ? new Date(openMs).toISOString() : (openMs > 1e7 ? new Date(openMs * 1000).toISOString() : null);
  const closeTime = closeMs > 1e10 ? new Date(closeMs).toISOString() : (closeMs > 1e7 ? new Date(closeMs * 1000).toISOString() : null);

  const grossPnl = Number(pos.pnl || pos.profit || 0);
  const commission = Math.abs(Number(pos.commission || pos.fee || 0));
  const swap = Number(pos.swap || 0);
  const netPnl = grossPnl - commission + swap; // swap can be negative

  const closeType = pos.closeType || pos.type || null;
  const orderId = pos.orderId ? String(pos.orderId) : null;
  const positionId = pos.id ? String(pos.id) : (pos.positionId ? String(pos.positionId) : null);

  return {
    symbol,
    side,
    quantity,
    entry_price: entryPrice,
    exit_price: exitPrice,
    sl,
    tp,
    open_time: openTime,
    close_time: closeTime,
    pnl: netPnl,
    commissions: commission,
    swap,
    close_type: closeType ? String(closeType) : null,
    broker_order_id: orderId,
    broker_position_id: positionId,
    status: closeTime ? "closed" : "open",
    raw: pos,
  };
}

function normalizeOrderHistory(
  order: Record<string, any>,
  instrumentMap: Map<number, string>
): NormalizedTrade | null {
  // ordersHistory has: id, tradableInstrumentId, side, qty, filledQty, avgFilledPrice,
  // status, type, createdAt, lastModifiedAt, stopLoss, takeProfit, commission, pnl, parentId
  const status = String(order.status || "").toLowerCase();
  if (status === "cancelled" || status === "rejected" || status === "expired") return null;

  const filledQty = Math.abs(Number(order.filledQty || 0));
  if (filledQty <= 0) return null;

  const instId = Number(order.tradableInstrumentId || order.instrumentId || 0);
  const symbol = instrumentMap.get(instId) || order.symbol || order.instrument || (instId > 0 ? `INST_${instId}` : "UNKNOWN");

  const sideRaw = String(order.side || "").toLowerCase();
  const side: "Long" | "Short" = sideRaw.includes("buy") || sideRaw === "long" ? "Long" : "Short";

  const entryPrice = Number(order.avgFilledPrice || order.price || 0);
  const sl = Number(order.stopLoss || 0) || null;
  const tp = Number(order.takeProfit || 0) || null;

  const createdMs = Number(order.createdAt || 0);
  const modifiedMs = Number(order.lastModifiedAt || order.filledAt || 0);
  const openTime = createdMs > 1e10 ? new Date(createdMs).toISOString() : null;
  const closeTime = modifiedMs > 1e10 ? new Date(modifiedMs).toISOString() : null;

  const grossPnl = Number(order.pnl || order.profit || 0);
  const commission = Math.abs(Number(order.commission || order.fee || 0));

  const orderType = String(order.type || "").toLowerCase();

  return {
    symbol,
    side,
    quantity: filledQty,
    entry_price: entryPrice,
    exit_price: null, // orders don't have exit price
    sl,
    tp,
    open_time: openTime,
    close_time: closeTime || openTime,
    pnl: grossPnl - commission,
    commissions: commission,
    swap: 0,
    close_type: orderType || null,
    broker_order_id: order.id ? String(order.id) : null,
    broker_position_id: order.parentId ? String(order.parentId) : null,
    status: "closed",
    raw: order,
  };
}

function validateNormalizedTrade(trade: NormalizedTrade): string[] {
  const errors: string[] = [];
  if (!trade.symbol || trade.symbol === "UNKNOWN") errors.push("missing symbol");
  if (trade.quantity <= 0) errors.push("invalid quantity");
  if (trade.entry_price <= 0) errors.push("invalid entry_price");
  if (!trade.open_time) errors.push("missing open_time");
  if (trade.status === "closed" && !trade.close_time) errors.push("missing close_time for closed trade");
  return errors;
}

// ---- Config / column fetching ----

const FALLBACK_ORDERS_COLUMNS = [
  "id", "tradableInstrumentId", "accountId", "qty", "side", "type", "status",
  "filledQty", "avgFilledPrice", "limitPrice", "stopPrice", "validity",
  "expireAt", "createdAt", "lastModifiedAt", "isFromHistory", "parentId",
  "stopLoss", "takeProfit", "trailingOffset", "commission", "pnl"
];

const FALLBACK_POSITIONS_COLUMNS = [
  "id", "tradableInstrumentId", "accountId", "qty", "side", "avgPrice",
  "unrealizedPnl", "swap", "commission", "openTimestamp", "stopLoss",
  "takeProfit", "trailingOffset"
];

async function fetchConfig(
  server: string, token: string, accNum: string
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  try {
    const config = await tlRequest(server, "GET", "/trade/config", token, undefined, accNum);
    const d = config.d || config;

    // Try all known config key patterns
    const configKeyMap: Record<string, string> = {
      ordersHistory: "ordersHistory",
      ordersHistoryConfig: "ordersHistory",
      positions: "positions",
      positionsConfig: "positions",
      positionsHistory: "positionsHistory",
      filledOrders: "filledOrders",
      filledOrdersConfig: "filledOrders",
    };

    for (const [sourceKey, targetKey] of Object.entries(configKeyMap)) {
      const section = d[sourceKey];
      if (section?.columns && Array.isArray(section.columns) && section.columns.length > 0) {
        result[targetKey] = section.columns;
        console.log(`[TL] Config: ${targetKey} from ${sourceKey} → ${section.columns.length} columns`);
      }
    }
  } catch (e: any) {
    console.warn("[TL] Config fetch failed:", e.message);
  }

  if (!result.ordersHistory) result.ordersHistory = FALLBACK_ORDERS_COLUMNS;
  if (!result.positions) result.positions = FALLBACK_POSITIONS_COLUMNS;

  return result;
}

// ---- Action Handlers ----

async function authenticate(
  userId: string,
  environment: string,
  serverName: string,
  email: string,
  password: string,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
  const authResult = await tlRequest(environment, "POST", "/auth/jwt/token", undefined, {
    email, password, server: serverName,
  });

  const accessToken = authResult.accessToken || authResult.access_token;
  const refreshToken = authResult.refreshToken || authResult.refresh_token;
  const expiresIn = authResult.expiresIn || authResult.expires_in || 3600;

  if (!accessToken || !refreshToken) {
    throw new Error("Authentication failed. Please check your credentials and server.");
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { data: existing } = await supabaseAdmin
    .from("broker_integrations")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "tradelocker")
    .maybeSingle();

  let integrationId: string;

  if (existing) {
    await supabaseAdmin.from("broker_integrations").update({
      tradelocker_server: environment,
      tradelocker_access_token_encrypted: accessToken,
      tradelocker_refresh_token_encrypted: refreshToken,
      tradelocker_token_expires_at: expiresAt,
      status: "active",
    }).eq("id", existing.id);
    integrationId = existing.id;
  } else {
    const { data: newInt, error } = await supabaseAdmin.from("broker_integrations").insert({
      user_id: userId, provider: "tradelocker",
      tradelocker_server: environment,
      tradelocker_access_token_encrypted: accessToken,
      tradelocker_refresh_token_encrypted: refreshToken,
      tradelocker_token_expires_at: expiresAt,
      status: "active",
    }).select().single();
    if (error) throw new Error(`Failed to save integration: ${error.message}`);
    integrationId = newInt.id;
  }

  const { data: existingConn } = await supabaseAdmin
    .from("broker_connections").select("id")
    .eq("integration_id", integrationId).eq("user_id", userId).maybeSingle();

  let connectionId: string;
  if (existingConn) {
    await supabaseAdmin.from("broker_connections").update({
      broker_name: "TradeLocker", connection_status: "connected",
      disabled: false, provider: "tradelocker",
    }).eq("id", existingConn.id);
    connectionId = existingConn.id;
  } else {
    const { data: newConn } = await supabaseAdmin.from("broker_connections").insert({
      user_id: userId, integration_id: integrationId,
      broker_name: "TradeLocker", connection_status: "connected", provider: "tradelocker",
    }).select().single();
    connectionId = newConn!.id;
  }

  try { await listAccounts(userId, supabaseAdmin); } catch {}

  return { success: true, integration_id: integrationId, connection_id: connectionId };
}

async function refreshAccessToken(integration: any, supabaseAdmin: any) {
  const server = integration.tradelocker_server;
  const result = await tlRequest(server, "POST", "/auth/jwt/refresh", undefined, {
    refreshToken: integration.tradelocker_refresh_token_encrypted,
  });
  const newAccessToken = result.accessToken || result.access_token;
  const newRefreshToken = result.refreshToken || result.refresh_token || integration.tradelocker_refresh_token_encrypted;
  const expiresIn = result.expiresIn || result.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

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

async function listAccounts(userId: string, supabaseAdmin: any) {
  const { data: integration } = await supabaseAdmin
    .from("broker_integrations").select("*")
    .eq("user_id", userId).eq("provider", "tradelocker").single();
  if (!integration) return { accounts: [] };

  const token = await getValidToken(integration, supabaseAdmin);
  const server = integration.tradelocker_server;
  const accountsResult = await tlRequest(server, "GET", "/auth/jwt/all-accounts", token);

  let accounts: any[] = [];
  const raw = accountsResult.accounts || accountsResult;
  if (Array.isArray(raw)) {
    accounts = raw;
  } else if (typeof raw === "object" && raw !== null) {
    for (const env of Object.keys(raw)) {
      const envAccounts = raw[env];
      if (Array.isArray(envAccounts)) accounts.push(...envAccounts);
    }
  }

  const { data: conn } = await supabaseAdmin
    .from("broker_connections").select("id")
    .eq("integration_id", integration.id).eq("user_id", userId).maybeSingle();
  if (!conn) return { accounts: [] };

  for (const acct of accounts) {
    const tlAccountId = String(acct.id || acct.accountId || "");
    const tlAccNum = String(acct.accNum ?? acct.acc_num ?? "");
    const accountName = acct.name || acct.accountName || `Account ${tlAccountId}`;
    const accountNumber = acct.accountNumber || acct.number || tlAccountId;
    const accountType = acct.type || acct.accountType || null;
    const currency = acct.currency || "USD";

    const { data: existing } = await supabaseAdmin
      .from("broker_accounts").select("id")
      .eq("tradelocker_account_id", tlAccountId).eq("user_id", userId).maybeSingle();

    const maskedNumber = tlAccNum
      ? `accnum:${tlAccNum}|${accountNumber.length > 4 ? `***${accountNumber.slice(-4)}` : accountNumber}`
      : (accountNumber.length > 4 ? `***${accountNumber.slice(-4)}` : accountNumber);

    const accountData = {
      broker_name: "TradeLocker", account_name: accountName,
      account_type: accountType, account_number_masked: maskedNumber,
      currency, provider: "tradelocker",
    };

    if (existing) {
      await supabaseAdmin.from("broker_accounts").update(accountData).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("broker_accounts").insert({
        user_id: userId, connection_id: conn.id,
        tradelocker_account_id: tlAccountId, ...accountData,
      });
    }
  }

  const { data: dbAccounts } = await supabaseAdmin
    .from("broker_accounts").select("*")
    .eq("user_id", userId).eq("provider", "tradelocker")
    .order("created_at", { ascending: false });

  return { accounts: dbAccounts || [] };
}

async function selectAccounts(userId: string, accountIds: string[], supabaseAdmin: any) {
  for (const id of accountIds) {
    await supabaseAdmin.from("broker_accounts")
      .update({ is_selected_for_import: true })
      .eq("id", id).eq("user_id", userId);
  }
  return { selected: accountIds.length };
}

function extractStoredAccNum(accountNumberMasked: string | null): string | null {
  if (!accountNumberMasked) return null;
  const match = accountNumberMasked.match(/^accnum:(\d+)\|/);
  return match ? match[1] : null;
}

// ---- SYNC ----

async function syncAccount(
  userId: string,
  accountId: string,
  jobType: string,
  supabaseAdmin: any
) {
  const { data: integration } = await supabaseAdmin
    .from("broker_integrations").select("*")
    .eq("user_id", userId).eq("provider", "tradelocker").single();
  if (!integration) throw new Error("No TradeLocker integration found");

  const { data: brokerAccount } = await supabaseAdmin
    .from("broker_accounts").select("*")
    .eq("id", accountId).eq("user_id", userId).single();
  if (!brokerAccount) throw new Error("Broker account not found");

  const token = await getValidToken(integration, supabaseAdmin);
  const server = integration.tradelocker_server;
  const tlAcctId = brokerAccount.tradelocker_account_id;

  let accNum = extractStoredAccNum(brokerAccount.account_number_masked);
  if (!accNum) {
    accNum = await resolveAccNum(server, token, tlAcctId!);
    await supabaseAdmin.from("broker_accounts")
      .update({ account_number_masked: `accnum:${accNum}|${brokerAccount.account_number_masked || ""}` })
      .eq("id", accountId);
  }

  console.log(`[TL] Sync: accountId=${tlAcctId} accNum=${accNum} jobType=${jobType}`);

  const configColumns = await fetchConfig(server, token, accNum);

  // Create sync job
  const { data: job } = await supabaseAdmin.from("sync_jobs").insert({
    user_id: userId, connection_id: brokerAccount.connection_id,
    account_id: accountId, job_type: jobType, status: "running",
    started_at: new Date().toISOString(), meta: { phase: "fetching_history" },
  }).select().single();

  const batchId = job?.id || crypto.randomUUID();

  // Get user's Momentra account
  const { data: momentraAccounts } = await supabaseAdmin
    .from("accounts").select("id").eq("user_id", userId).limit(1);
  const momentraAccountId = momentraAccounts?.[0]?.id;

  try {
    let imported = 0;
    let skippedDupes = 0;
    let validationFails = 0;

    // ========== PHASE 1: Try positionsHistory (closed positions with entry+exit) ==========
    console.log("[TL] Phase 1: Trying positionsHistory endpoint...");
    await supabaseAdmin.from("sync_jobs").update({ meta: { phase: "fetching_positions_history" } }).eq("id", job?.id);

    let usedPositionsHistory = false;

    // Try multiple endpoint patterns for closed position history
    const posHistoryEndpoints = [
      `/trade/accounts/${tlAcctId}/positionsHistory`,
      `/trade/accounts/${tlAcctId}/positions/history`,
      `/trade/accounts/${tlAcctId}/closedPositions`,
    ];

    for (const endpoint of posHistoryEndpoints) {
      const posHistResult = await tlRequestSafe(server, "GET", endpoint, token, undefined, accNum);
      if (!posHistResult) continue;

      const rawData = posHistResult.d?.positionsHistory || posHistResult.d?.positions ||
        posHistResult.d?.closedPositions || posHistResult.positionsHistory ||
        posHistResult.positions || posHistResult.closedPositions || [];
      const positions = Array.isArray(rawData) ? rawData : [];

      if (positions.length === 0) continue;

      console.log(`[TL] positionsHistory from ${endpoint}: ${positions.length} records`);
      usedPositionsHistory = true;

      // Get columns from response or config
      const resCols = posHistResult.d?.columns || posHistResult.columns || configColumns.positionsHistory || [];
      console.log(`[TL] positionsHistory columns (${resCols.length}): ${JSON.stringify(resCols).slice(0, 300)}`);

      // Log first raw row
      if (positions.length > 0) {
        console.log(`[TL] First posHist row: ${JSON.stringify(positions[0]).slice(0, 400)}`);
      }

      const posObjects = parseColumnarData(positions, resCols);
      if (posObjects.length > 0) {
        console.log(`[TL] First posHist object: ${JSON.stringify(posObjects[0]).slice(0, 400)}`);
      }

      // Resolve instruments
      const instIds = new Set<number>();
      for (const p of posObjects) {
        const id = Number(p.tradableInstrumentId || p.instrumentId || 0);
        if (id > 0) instIds.add(id);
      }
      const instrumentMap = await resolveInstruments(server, token, accNum, Array.from(instIds));

      await supabaseAdmin.from("sync_jobs").update({
        meta: { phase: "importing_closed_positions", positions_found: posObjects.length }
      }).eq("id", job?.id);

      for (const pos of posObjects) {
        const normalized = normalizePositionHistory(pos, instrumentMap);
        if (!normalized) continue;

        const sourceId = `pos_${normalized.broker_position_id || normalized.broker_order_id || ""}`;

        // Dedupe
        if (sourceId !== "pos_") {
          const { data: existing } = await supabaseAdmin
            .from("broker_activities_raw").select("id")
            .eq("source_activity_id", sourceId)
            .eq("account_id", accountId)
            .eq("source_provider", "tradelocker").maybeSingle();
          if (existing) { skippedDupes++; continue; }
        }

        // Validate
        const errors = validateNormalizedTrade(normalized);
        if (errors.length > 0) {
          console.warn(`[TL] Validation failed for ${sourceId}: ${errors.join(", ")}`);
          validationFails++;
          // Still save raw activity for debugging
          await supabaseAdmin.from("broker_activities_raw").insert({
            user_id: userId, account_id: accountId, source_provider: "tradelocker",
            source_activity_id: sourceId, activity_date: normalized.close_time || normalized.open_time,
            raw_payload: normalized.raw, import_batch_id: batchId,
          });
          continue;
        }

        // Save raw activity
        await supabaseAdmin.from("broker_activities_raw").insert({
          user_id: userId, account_id: accountId, source_provider: "tradelocker",
          source_activity_id: sourceId,
          activity_date: normalized.close_time || normalized.open_time,
          symbol: normalized.symbol,
          raw_payload: normalized.raw, import_batch_id: batchId,
        });

        if (!momentraAccountId) continue;

        // Log the normalized → Momentra mapping for debugging
        console.log(`[TL] Trade: ${normalized.symbol} ${normalized.side} qty=${normalized.quantity} entry=${normalized.entry_price} exit=${normalized.exit_price} pnl=${normalized.pnl} fees=${normalized.commissions}`);

        await supabaseAdmin.from("trades").insert({
          user_id: userId, account_id: momentraAccountId,
          symbol: normalized.symbol, side: normalized.side,
          quantity: normalized.quantity,
          entry_price: normalized.entry_price,
          exit_price: normalized.exit_price,
          sl: normalized.sl, tp: normalized.tp,
          pnl: normalized.pnl, commissions: normalized.commissions,
          open_time: normalized.open_time,
          close_time: normalized.close_time,
          status: normalized.status,
          tags: ["broker-import", "tradelocker"],
          note: normalized.close_type
            ? `Imported from TradeLocker (closed by ${normalized.close_type})`
            : "Imported from TradeLocker",
        });

        imported++;
      }

      break; // found working endpoint
    }

    // ========== PHASE 2: Fallback to ordersHistory if positionsHistory not available ==========
    if (!usedPositionsHistory) {
      console.log("[TL] Phase 2: positionsHistory not available, using ordersHistory fallback...");
      await supabaseAdmin.from("sync_jobs").update({ meta: { phase: "fetching_order_history" } }).eq("id", job?.id);

      try {
        const ordersResult = await tlRequest(
          server, "GET", `/trade/accounts/${tlAcctId}/ordersHistory`, token, undefined, accNum
        );

        const rawOrders = ordersResult.d?.ordersHistory || ordersResult.d?.orders || ordersResult.orders || [];
        const orders = Array.isArray(rawOrders) ? rawOrders : [];
        console.log(`[TL] Orders history: ${orders.length} records`);

        const ordersCols = configColumns.ordersHistory || FALLBACK_ORDERS_COLUMNS;
        const orderObjects = parseColumnarData(orders, ordersCols);

        if (orderObjects.length > 0) {
          console.log(`[TL] First order object: ${JSON.stringify(orderObjects[0]).slice(0, 400)}`);
        }

        // Resolve instruments
        const instIds = new Set<number>();
        for (const o of orderObjects) {
          const id = Number(o.tradableInstrumentId || o.instrumentId || 0);
          if (id > 0) instIds.add(id);
        }
        const instrumentMap = await resolveInstruments(server, token, accNum, Array.from(instIds));

        // Group orders by parentId to reconstruct positions
        const positionGroups = new Map<string, Record<string, any>[]>();
        const standaloneOrders: Record<string, any>[] = [];

        for (const order of orderObjects) {
          const parentId = order.parentId ? String(order.parentId) : null;
          if (parentId && parentId !== "0" && parentId !== "null") {
            if (!positionGroups.has(parentId)) positionGroups.set(parentId, []);
            positionGroups.get(parentId)!.push(order);
          } else {
            standaloneOrders.push(order);
          }
        }

        console.log(`[TL] Order grouping: ${positionGroups.size} position groups, ${standaloneOrders.length} standalone orders`);

        await supabaseAdmin.from("sync_jobs").update({
          meta: { phase: "importing_orders", orders_found: orderObjects.length, groups: positionGroups.size }
        }).eq("id", job?.id);

        // Process grouped orders (reconstruct positions from order legs)
        for (const [parentId, groupOrders] of positionGroups) {
          const sourceId = `grp_${parentId}`;

          const { data: existing } = await supabaseAdmin
            .from("broker_activities_raw").select("id")
            .eq("source_activity_id", sourceId)
            .eq("account_id", accountId)
            .eq("source_provider", "tradelocker").maybeSingle();
          if (existing) { skippedDupes++; continue; }

          // Sort by createdAt to find entry (first) and exit (last)
          groupOrders.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

          const entryOrder = groupOrders[0];
          const exitOrder = groupOrders.length > 1 ? groupOrders[groupOrders.length - 1] : null;

          const instId = Number(entryOrder.tradableInstrumentId || 0);
          const symbol = instrumentMap.get(instId) || entryOrder.symbol || (instId > 0 ? `INST_${instId}` : "UNKNOWN");
          const sideRaw = String(entryOrder.side || "").toLowerCase();
          const side: "Long" | "Short" = sideRaw.includes("buy") || sideRaw === "long" ? "Long" : "Short";

          const quantity = Math.abs(Number(entryOrder.filledQty || entryOrder.qty || 0));
          const entryPrice = Number(entryOrder.avgFilledPrice || 0);
          const exitPrice = exitOrder ? Number(exitOrder.avgFilledPrice || 0) || null : null;
          const exitStatus = exitOrder ? String(exitOrder.status || "").toLowerCase() : "";

          // Skip if entry order was cancelled
          const entryStatus = String(entryOrder.status || "").toLowerCase();
          if (entryStatus === "cancelled" || entryStatus === "rejected") continue;

          // Aggregate PnL and commission across all legs
          let totalPnl = 0;
          let totalCommission = 0;
          for (const o of groupOrders) {
            totalPnl += Number(o.pnl || 0);
            totalCommission += Math.abs(Number(o.commission || 0));
          }

          const createdMs = Number(entryOrder.createdAt || 0);
          const closedMs = exitOrder ? Number(exitOrder.lastModifiedAt || exitOrder.createdAt || 0) : Number(entryOrder.lastModifiedAt || 0);
          const openTime = createdMs > 1e10 ? new Date(createdMs).toISOString() : null;
          const closeTime = closedMs > 1e10 ? new Date(closedMs).toISOString() : null;
          const closeType = exitOrder ? String(exitOrder.type || "") : null;

          const sl = Number(entryOrder.stopLoss || 0) || null;
          const tp = Number(entryOrder.takeProfit || 0) || null;

          // Save raw
          await supabaseAdmin.from("broker_activities_raw").insert({
            user_id: userId, account_id: accountId, source_provider: "tradelocker",
            source_activity_id: sourceId,
            activity_date: closeTime || openTime,
            symbol, raw_payload: { entry: entryOrder, exit: exitOrder, all_legs: groupOrders },
            import_batch_id: batchId,
          });

          if (!momentraAccountId || quantity <= 0 || entryPrice <= 0) continue;

          console.log(`[TL] Grouped trade: ${symbol} ${side} qty=${quantity} entry=${entryPrice} exit=${exitPrice} pnl=${totalPnl} fees=${totalCommission} closeType=${closeType}`);

          await supabaseAdmin.from("trades").insert({
            user_id: userId, account_id: momentraAccountId,
            symbol, side, quantity,
            entry_price: entryPrice,
            exit_price: exitPrice,
            sl, tp,
            pnl: totalPnl - totalCommission,
            commissions: totalCommission,
            open_time: openTime,
            close_time: closeTime || openTime,
            status: exitPrice ? "closed" : "open",
            tags: ["broker-import", "tradelocker"],
            note: closeType ? `Imported from TradeLocker (${closeType})` : "Imported from TradeLocker",
          });

          imported++;
        }

        // Process standalone orders (no parentId grouping possible)
        for (const order of standaloneOrders) {
          const normalized = normalizeOrderHistory(order, instrumentMap);
          if (!normalized) continue;

          const sourceId = `ord_${normalized.broker_order_id || ""}`;
          if (sourceId !== "ord_") {
            const { data: existing } = await supabaseAdmin
              .from("broker_activities_raw").select("id")
              .eq("source_activity_id", sourceId)
              .eq("account_id", accountId)
              .eq("source_provider", "tradelocker").maybeSingle();
            if (existing) { skippedDupes++; continue; }
          }

          await supabaseAdmin.from("broker_activities_raw").insert({
            user_id: userId, account_id: accountId, source_provider: "tradelocker",
            source_activity_id: sourceId,
            activity_date: normalized.close_time || normalized.open_time,
            symbol: normalized.symbol,
            raw_payload: normalized.raw, import_batch_id: batchId,
          });

          if (!momentraAccountId) continue;

          const errors = validateNormalizedTrade(normalized);
          if (errors.length > 0) {
            console.warn(`[TL] Standalone validation: ${sourceId}: ${errors.join(", ")}`);
            validationFails++;
            continue;
          }

          console.log(`[TL] Standalone: ${normalized.symbol} ${normalized.side} qty=${normalized.quantity} entry=${normalized.entry_price} pnl=${normalized.pnl}`);

          await supabaseAdmin.from("trades").insert({
            user_id: userId, account_id: momentraAccountId,
            symbol: normalized.symbol, side: normalized.side,
            quantity: normalized.quantity,
            entry_price: normalized.entry_price,
            exit_price: normalized.exit_price,
            sl: normalized.sl, tp: normalized.tp,
            pnl: normalized.pnl, commissions: normalized.commissions,
            open_time: normalized.open_time,
            close_time: normalized.close_time || normalized.open_time,
            status: "closed",
            tags: ["broker-import", "tradelocker"],
            note: "Imported from TradeLocker",
          });

          imported++;
        }
      } catch (e: any) {
        console.error("[TL] Orders history fetch failed:", e.message);
      }
    }

    // ========== PHASE 3: Fetch current open positions ==========
    console.log("[TL] Phase 3: Fetching open positions...");
    await supabaseAdmin.from("sync_jobs").update({ meta: { phase: "importing_open_positions" } }).eq("id", job?.id);

    let positionsImported = 0;
    try {
      const posResult = await tlRequest(
        server, "GET", `/trade/accounts/${tlAcctId}/positions`, token, undefined, accNum
      );
      const rawPositions = posResult.d?.positions || posResult.positions || [];
      const positions = Array.isArray(rawPositions) ? rawPositions : [];
      console.log(`[TL] Open positions: ${positions.length}`);

      const posCols = configColumns.positions || FALLBACK_POSITIONS_COLUMNS;
      const posObjects = parseColumnarData(positions, posCols);

      const posInstIds = new Set<number>();
      for (const p of posObjects) {
        const id = Number(p.tradableInstrumentId || p.instrumentId || 0);
        if (id > 0) posInstIds.add(id);
      }
      const posInstrumentMap = posInstIds.size > 0
        ? await resolveInstruments(server, token, accNum, Array.from(posInstIds))
        : new Map<number, string>();

      for (const pos of posObjects) {
        const posId = String(pos.id || pos.positionId || "");
        const sourceId = `openpos_${posId}`;

        const { data: existing } = await supabaseAdmin
          .from("broker_activities_raw").select("id")
          .eq("source_activity_id", sourceId)
          .eq("account_id", accountId)
          .eq("source_provider", "tradelocker").maybeSingle();
        if (existing) { skippedDupes++; continue; }

        const instId = Number(pos.tradableInstrumentId || 0);
        const symbol = posInstrumentMap.get(instId) || pos.symbol || (instId > 0 ? `INST_${instId}` : "UNKNOWN");
        const sideRaw = String(pos.side || "").toLowerCase();
        const side = sideRaw.includes("buy") || sideRaw === "long" ? "Long" : "Short";
        const quantity = Math.abs(Number(pos.qty || 0));
        const entryPrice = Number(pos.avgPrice || pos.openPrice || 0);
        const openMs = Number(pos.openTimestamp || pos.openedAt || 0);
        const openTime = openMs > 1e10 ? new Date(openMs).toISOString() : null;

        await supabaseAdmin.from("broker_activities_raw").insert({
          user_id: userId, account_id: accountId, source_provider: "tradelocker",
          source_activity_id: sourceId, activity_date: openTime,
          symbol, raw_payload: pos, import_batch_id: batchId,
        });

        if (!momentraAccountId || quantity <= 0) continue;

        await supabaseAdmin.from("trades").insert({
          user_id: userId, account_id: momentraAccountId,
          symbol, side, quantity, entry_price: entryPrice,
          sl: Number(pos.stopLoss || 0) || null,
          tp: Number(pos.takeProfit || 0) || null,
          pnl: Number(pos.unrealizedPnl || 0),
          open_time: openTime, status: "open",
          tags: ["broker-import", "tradelocker", "open-position"],
          note: "Open position from TradeLocker",
        });

        positionsImported++;
        imported++;
      }
    } catch (e: any) {
      console.error("[TL] Positions fetch failed:", e.message);
    }

    // ========== COMPLETE ==========
    const syncStatus = imported > 0 ? "completed" : "completed_no_data";
    console.log(`[TL] === SYNC SUMMARY ===`);
    console.log(`[TL]   Method: ${usedPositionsHistory ? "positionsHistory" : "ordersHistory (grouped)"}`);
    console.log(`[TL]   Imported: ${imported} (${imported - positionsImported} closed, ${positionsImported} open)`);
    console.log(`[TL]   Duplicates skipped: ${skippedDupes}`);
    console.log(`[TL]   Validation failures: ${validationFails}`);

    await supabaseAdmin.from("sync_jobs").update({
      status: syncStatus, completed_at: new Date().toISOString(),
      activities_imported: imported,
      meta: {
        phase: "complete", method: usedPositionsHistory ? "positionsHistory" : "ordersHistory",
        closed_trades: imported - positionsImported, open_positions: positionsImported,
        duplicates_skipped: skippedDupes, validation_failures: validationFails,
      },
    }).eq("id", job?.id);

    await supabaseAdmin.from("broker_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", brokerAccount.connection_id);

    return { success: true, imported, job_id: job?.id };
  } catch (err: any) {
    console.error("[TL] Sync failed:", err.message);
    await supabaseAdmin.from("sync_jobs").update({
      status: "failed", completed_at: new Date().toISOString(),
      error_message: err.message, meta: { phase: "failed" },
    }).eq("id", job?.id);
    throw err;
  }
}

async function disconnectConnection(userId: string, connectionId: string, supabaseAdmin: any) {
  await supabaseAdmin.from("broker_connections")
    .update({ connection_status: "disconnected", disabled: true })
    .eq("id", connectionId).eq("user_id", userId);
  return { success: true };
}

// ---- Main Handler ----
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const body = req.method === "GET" ? {} : await req.json();
    const action = body.action || new URL(req.url).searchParams.get("action");

    let result: unknown;

    switch (action) {
      case "authenticate": {
        if (!body.email || !body.password) throw new Error("Email and password are required");
        const environment = body.environment || "demo.tradelocker.com";
        const serverName = body.server_name || body.server || "";
        if (!serverName) throw new Error("Server name is required (e.g. BLBRY, FTMO)");
        const envHost = environment.includes(".") ? environment : `${environment}.tradelocker.com`;
        result = await authenticate(userId, envHost, serverName, body.email, body.password, supabaseAdmin);
        break;
      }
      case "list_accounts":
        result = await listAccounts(userId, supabaseAdmin);
        break;
      case "select_accounts":
        result = await selectAccounts(userId, body.account_ids || [], supabaseAdmin);
        break;
      case "sync":
        result = await syncAccount(userId, body.account_id, body.job_type || "manual_sync", supabaseAdmin);
        break;
      case "disconnect":
        result = await disconnectConnection(userId, body.connection_id, supabaseAdmin);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[TL] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
