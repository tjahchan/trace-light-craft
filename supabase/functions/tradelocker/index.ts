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
  server: string, method: string, path: string,
  accessToken?: string, body?: Record<string, unknown>, accNum?: string
) {
  const baseUrl = server.startsWith("https://") ? server : `https://${server}`;
  const url = `${baseUrl}/backend-api${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  if (accNum) headers["accNum"] = accNum;

  console.log(`[TL] ${method} ${path} (accNum: ${accNum || "none"})`);

  const res = await fetch(url, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[TL] ${method} ${path} failed: ${res.status} ${errText.slice(0, 200)}`);
    throw new Error(`TradeLocker API error: ${res.status} - ${errText}`);
  }

  return res.json();
}

async function tlRequestSafe(
  server: string, method: string, path: string,
  accessToken?: string, body?: Record<string, unknown>, accNum?: string
): Promise<any | null> {
  try { return await tlRequest(server, method, path, accessToken, body, accNum); }
  catch { return null; }
}

// ---- accNum resolution ----

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
    const acctId = String(acct.id || acct.accountId || "");
    const an = String(acct.accNum ?? acct.acc_num ?? "");
    if (acctId === targetAccountId && an) return an;
  }
  if (allAccounts.length === 1) {
    return String(allAccounts[0].accNum ?? allAccounts[0].acc_num ?? allAccounts[0].id ?? "");
  }
  return targetAccountId;
}

// ---- Columnar data helpers ----
// CRITICAL: TradeLocker config columns can be objects like {name:"id",type:"string"}
// We must extract the string name from each column entry.

function extractColumnNames(columns: any[]): string[] {
  return columns.map((col: any) => {
    if (typeof col === "string") return col;
    if (typeof col === "object" && col !== null) return String(col.name || col.id || col.key || "");
    return String(col);
  });
}

function rowToObject(row: any[], columns: string[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (let i = 0; i < columns.length && i < row.length; i++) {
    obj[columns[i]] = row[i];
  }
  return obj;
}

function parseColumnarData(data: any[], rawColumns: any[]): Record<string, any>[] {
  if (data.length === 0) return [];
  const columns = extractColumnNames(rawColumns);

  // If rows are arrays and we have column names, map them
  if (Array.isArray(data[0]) && columns.length > 0) {
    return data.map((row: any[]) => rowToObject(row, columns));
  }
  // If rows are already objects, return as-is
  if (typeof data[0] === "object" && !Array.isArray(data[0])) {
    return data;
  }
  return [];
}

// ---- Instrument resolution ----

async function resolveInstruments(
  server: string, token: string, accNum: string, instrumentIds: number[],
  accountId?: string
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (instrumentIds.length === 0) return map;

  // The correct endpoint uses accountId in the path, accNum in the header
  const acctIdForPath = accountId || accNum;

  // Try fetching all instruments for the account and filter
  const allInstrumentsEndpoint = `/trade/accounts/${acctIdForPath}/instruments`;
  const allResult = await tlRequestSafe(server, "GET", allInstrumentsEndpoint, token, undefined, accNum);
  if (allResult) {
    const instruments = allResult.d?.instruments || allResult.instruments || [];
    const cols = extractColumnNames(allResult.d?.columns || allResult.columns || []);
    
    if (Array.isArray(instruments) && instruments.length > 0) {
      if (Array.isArray(instruments[0]) && cols.length > 0) {
        const nameIdx = cols.indexOf("name");
        const symIdx = cols.indexOf("symbol");
        const idIdx = cols.indexOf("tradableInstrumentId");
        const ni = nameIdx >= 0 ? nameIdx : symIdx;
        if (ni >= 0 && idIdx >= 0) {
          const idSet = new Set(instrumentIds);
          for (const row of instruments) {
            if (Array.isArray(row) && idSet.has(Number(row[idIdx]))) {
              map.set(Number(row[idIdx]), String(row[ni]));
            }
          }
        }
      } else if (typeof instruments[0] === "object" && !Array.isArray(instruments[0])) {
        const idSet = new Set(instrumentIds);
        for (const inst of instruments) {
          const instId = Number(inst.tradableInstrumentId || inst.id || 0);
          if (idSet.has(instId)) {
            map.set(instId, String(inst.name || inst.symbol || ""));
          }
        }
      }
    }
  }

  // Individual lookups fallback using accountId in path
  if (map.size < instrumentIds.length) {
    const missing = instrumentIds.filter(id => !map.has(id));
    console.log(`[TL] Trying individual instrument lookups for ${missing.length} instruments...`);
    for (const instId of missing.slice(0, 20)) {
      const r = await tlRequestSafe(server, "GET", `/trade/instruments/${instId}`, token, undefined, accNum);
      if (r) {
        const d = r.d || r;
        const name = d?.name || d?.symbol || null;
        if (name) { map.set(instId, String(name)); continue; }
      }
      // Try with accountId path
      const r2 = await tlRequestSafe(server, "GET", `/trade/accounts/${acctIdForPath}/instruments/${instId}`, token, undefined, accNum);
      if (r2) {
        const d = r2.d || r2;
        const name = d?.name || d?.symbol || null;
        if (name) map.set(instId, String(name));
      }
    }
  }

  console.log(`[TL] Resolved ${map.size}/${instrumentIds.length} instruments`);
  for (const [id, name] of map) console.log(`[TL]   ${id} → ${name}`);
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

function msToIso(ms: number): string | null {
  if (ms > 1e12) return new Date(ms).toISOString();       // milliseconds
  if (ms > 1e9) return new Date(ms * 1000).toISOString();  // seconds
  return null;
}

function normalizePositionHistory(
  pos: Record<string, any>, instrumentMap: Map<number, string>
): NormalizedTrade | null {
  const instId = Number(pos.tradableInstrumentId || pos.instrumentId || 0);
  const symbol = instrumentMap.get(instId) || pos.symbol || pos.instrument || (instId > 0 ? `INST_${instId}` : "UNKNOWN");
  const sideRaw = String(pos.side || "").toLowerCase();
  const side: "Long" | "Short" = sideRaw.includes("buy") || sideRaw === "long" ? "Long" : "Short";
  const quantity = Math.abs(Number(pos.qty || pos.quantity || pos.filledQty || 0));
  if (quantity <= 0) return null;

  // Handle both field name variants: avgPrice/avgFilledPrice, createdDate/createdAt, etc.
  const entryPrice = Number(pos.avgPrice || pos.avgFilledPrice || pos.entryPrice || pos.openPrice || pos.price || 0);
  const exitPrice = Number(pos.closePrice || pos.exitPrice || pos.avgClosePrice || 0) || null;
  const sl = Number(pos.stopLoss || pos.sl || 0) || null;
  const tp = Number(pos.takeProfit || pos.tp || 0) || null;
  const openTime = msToIso(Number(pos.openTimestamp || pos.openedAt || pos.createdAt || pos.createdDate || 0));
  const closeTime = msToIso(Number(pos.closeTimestamp || pos.closedAt || pos.lastModifiedAt || pos.lastModified || 0));
  const grossPnl = Number(pos.pnl || pos.profit || 0);
  const commission = Math.abs(Number(pos.commission || pos.fee || 0));
  const swap = Number(pos.swap || 0);

  return {
    symbol, side, quantity, entry_price: entryPrice, exit_price: exitPrice, sl, tp,
    open_time: openTime, close_time: closeTime,
    pnl: grossPnl - commission + swap,
    commissions: commission, swap,
    close_type: pos.closeType || pos.type ? String(pos.closeType || pos.type) : null,
    broker_order_id: pos.orderId ? String(pos.orderId) : (pos.id ? String(pos.id) : null),
    broker_position_id: pos.positionId ? String(pos.positionId) : (pos.id ? String(pos.id) : null),
    status: closeTime ? "closed" : "open",
    raw: pos,
  };
}

function normalizeGroupedOrders(
  entry: Record<string, any>,
  exit: Record<string, any> | null,
  allLegs: Record<string, any>[],
  instrumentMap: Map<number, string>
): NormalizedTrade | null {
  const entryStatus = String(entry.status || "").toLowerCase();
  if (entryStatus === "cancelled" || entryStatus === "rejected") return null;

  const instId = Number(entry.tradableInstrumentId || 0);
  const symbol = instrumentMap.get(instId) || entry.symbol || (instId > 0 ? `INST_${instId}` : "UNKNOWN");
  const sideRaw = String(entry.side || "").toLowerCase();
  const side: "Long" | "Short" = sideRaw.includes("buy") || sideRaw === "long" ? "Long" : "Short";
  const quantity = Math.abs(Number(entry.filledQty || entry.qty || 0));
  if (quantity <= 0) return null;

  const entryPrice = Number(entry.avgFilledPrice || entry.avgPrice || entry.price || 0);
  const exitPrice = exit ? (Number(exit.avgFilledPrice || exit.avgPrice || exit.price || 0) || null) : null;

  // Extract SL/TP from cancelled stop/limit orders in the group
  let sl: number | null = Number(entry.stopLoss || 0) || null;
  let tp: number | null = Number(entry.takeProfit || 0) || null;
  for (const leg of allLegs) {
    const legStatus = String(leg.status || "").toLowerCase();
    const legType = String(leg.type || "").toLowerCase();
    if (legStatus === "cancelled" || legStatus === "filled") {
      if (!sl && (legType === "stop" || legType === "stop_loss" || legType.includes("stop"))) {
        const stopPrice = Number(leg.price || leg.stopPrice || 0);
        if (stopPrice > 0) sl = stopPrice;
      }
      if (!tp && (legType === "limit" || legType === "take_profit" || legType.includes("profit"))) {
        const limitPrice = Number(leg.price || leg.limitPrice || 0);
        if (limitPrice > 0) tp = limitPrice;
      }
    }
  }

  const openTime = msToIso(Number(entry.createdAt || entry.createdDate || 0));
  const closedMs = exit
    ? Number(exit.lastModifiedAt || exit.lastModified || exit.createdAt || exit.createdDate || 0)
    : Number(entry.lastModifiedAt || entry.lastModified || 0);
  const closeTime = msToIso(closedMs);

  let totalPnl = 0, totalCommission = 0;
  for (const l of allLegs) {
    totalPnl += Number(l.pnl || 0);
    totalCommission += Math.abs(Number(l.commission || 0));
  }

  // If no PnL from legs, calculate from entry/exit prices
  if (totalPnl === 0 && exitPrice && entryPrice > 0) {
    const priceDiff = side === "Long" ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
    totalPnl = priceDiff * quantity;
  }

  return {
    symbol, side, quantity, entry_price: entryPrice, exit_price: exitPrice, sl, tp,
    open_time: openTime, close_time: closeTime || openTime,
    pnl: totalPnl - totalCommission,
    commissions: totalCommission, swap: 0,
    close_type: exit ? String(exit.type || "") : null,
    broker_order_id: entry.id ? String(entry.id) : null,
    broker_position_id: entry.positionId ? String(entry.positionId) : (entry.parentId ? String(entry.parentId) : null),
    status: exitPrice ? "closed" : "open",
    raw: { entry, exit, all_legs: allLegs },
  };
}

function normalizeStandaloneOrder(
  order: Record<string, any>, instrumentMap: Map<number, string>
): NormalizedTrade | null {
  const status = String(order.status || "").toLowerCase();
  if (status === "cancelled" || status === "rejected" || status === "expired") return null;
  const filledQty = Math.abs(Number(order.filledQty || 0));
  if (filledQty <= 0) return null;

  const instId = Number(order.tradableInstrumentId || 0);
  const symbol = instrumentMap.get(instId) || order.symbol || (instId > 0 ? `INST_${instId}` : "UNKNOWN");
  const sideRaw = String(order.side || "").toLowerCase();
  const side: "Long" | "Short" = sideRaw.includes("buy") || sideRaw === "long" ? "Long" : "Short";
  // Handle both avgFilledPrice and avgPrice
  const entryPrice = Number(order.avgFilledPrice || order.avgPrice || order.price || 0);
  // Handle both createdAt and createdDate
  const openTime = msToIso(Number(order.createdAt || order.createdDate || 0));
  const closeTime = msToIso(Number(order.lastModifiedAt || order.lastModified || order.filledAt || 0));
  const grossPnl = Number(order.pnl || 0);
  const commission = Math.abs(Number(order.commission || 0));

  return {
    symbol, side, quantity: filledQty,
    entry_price: entryPrice, exit_price: null, sl: null, tp: null,
    open_time: openTime, close_time: closeTime || openTime,
    pnl: grossPnl - commission, commissions: commission, swap: 0,
    close_type: order.type ? String(order.type) : null,
    broker_order_id: order.id ? String(order.id) : null,
    broker_position_id: order.positionId ? String(order.positionId) : (order.parentId ? String(order.parentId) : null),
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
  if (trade.status === "closed" && !trade.close_time) errors.push("missing close_time");
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

async function fetchConfig(server: string, token: string, accNum: string): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  try {
    const config = await tlRequest(server, "GET", "/trade/config", token, undefined, accNum);
    const d = config.d || config;

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
        // CRITICAL: extract string names from column objects
        const colNames = extractColumnNames(section.columns);
        result[targetKey] = colNames;
        console.log(`[TL] Config: ${targetKey} from ${sourceKey} → ${colNames.length} cols: [${colNames.slice(0, 5).join(", ")}...]`);
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
  userId: string, environment: string, serverName: string,
  email: string, password: string, supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
  const authResult = await tlRequest(environment, "POST", "/auth/jwt/token", undefined, {
    email, password, server: serverName,
  });

  const accessToken = authResult.accessToken || authResult.access_token;
  const refreshToken = authResult.refreshToken || authResult.refresh_token;
  const expiresIn = authResult.expiresIn || authResult.expires_in || 3600;
  if (!accessToken || !refreshToken) throw new Error("Authentication failed. Check credentials and server.");

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { data: existing } = await supabaseAdmin
    .from("broker_integrations").select("id")
    .eq("user_id", userId).eq("provider", "tradelocker").maybeSingle();

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
  if (Array.isArray(raw)) accounts = raw;
  else if (typeof raw === "object" && raw !== null) {
    for (const env of Object.keys(raw)) {
      if (Array.isArray(raw[env])) accounts.push(...raw[env]);
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

// ---- SYNC (core trade import pipeline) ----

async function importNormalizedTrade(
  normalized: NormalizedTrade,
  sourceId: string,
  userId: string,
  accountId: string,
  momentraAccountId: string,
  batchId: string,
  forceResync: boolean,
  supabaseAdmin: any
): Promise<"imported" | "skipped_dupe" | "validation_fail"> {
  // Dedupe check (skip if force resync)
  if (!forceResync && sourceId) {
    const { data: existing } = await supabaseAdmin
      .from("broker_activities_raw").select("id")
      .eq("source_activity_id", sourceId)
      .eq("account_id", accountId)
      .eq("source_provider", "tradelocker").maybeSingle();
    if (existing) return "skipped_dupe";
  }

  // Validate
  const errors = validateNormalizedTrade(normalized);
  if (errors.length > 0) {
    console.warn(`[TL] Validation failed for ${sourceId}: ${errors.join(", ")}`);
    return "validation_fail";
  }

  // Log the normalized trade for debugging
  console.log(`[TL] Trade: ${normalized.symbol} ${normalized.side} qty=${normalized.quantity} entry=${normalized.entry_price} exit=${normalized.exit_price} pnl=${normalized.pnl} fees=${normalized.commissions}`);

  // Save raw activity
  await supabaseAdmin.from("broker_activities_raw").insert({
    user_id: userId, account_id: accountId, source_provider: "tradelocker",
    source_activity_id: sourceId,
    activity_date: normalized.close_time || normalized.open_time,
    symbol: normalized.symbol,
    raw_payload: normalized.raw, import_batch_id: batchId,
  });

  // Insert into trades
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
      ? `Imported from TradeLocker (${normalized.close_type})`
      : "Imported from TradeLocker",
  });

  return "imported";
}

async function syncAccount(
  userId: string, accountId: string, jobType: string, supabaseAdmin: any
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

  // Determine if this is a force resync
  const forceResync = jobType === "force_resync" || jobType === "full_resync";

  console.log(`[TL] Sync: accountId=${tlAcctId} accNum=${accNum} jobType=${jobType} force=${forceResync}`);

  // If force resync, clear old raw activities and imported trades for this broker account
  if (forceResync) {
    console.log("[TL] Force resync: clearing old imported data...");
    // Get user's momentra account to delete trades
    const { data: momentraAccounts } = await supabaseAdmin
      .from("accounts").select("id").eq("user_id", userId).limit(1);
    const mAccId = momentraAccounts?.[0]?.id;

    // Delete old raw activities for this broker account
    await supabaseAdmin.from("broker_activities_raw")
      .delete().eq("account_id", accountId).eq("source_provider", "tradelocker");

    // Delete old trades tagged with tradelocker for this momentra account
    if (mAccId) {
      const { data: oldTrades } = await supabaseAdmin.from("trades")
        .select("id").eq("user_id", userId).eq("account_id", mAccId)
        .contains("tags", ["tradelocker"]);
      if (oldTrades && oldTrades.length > 0) {
        const ids = oldTrades.map((t: any) => t.id);
        await supabaseAdmin.from("trades").delete().in("id", ids);
        console.log(`[TL] Cleared ${ids.length} old imported trades`);
      }
    }
  }

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

  if (!momentraAccountId) {
    throw new Error("No Momentra account found. Please create an account first.");
  }

  try {
    let imported = 0, skippedDupes = 0, validationFails = 0;

    // ========== PHASE 1: Try positionsHistory ==========
    console.log("[TL] Phase 1: Trying positionsHistory endpoint...");
    let usedPositionsHistory = false;

    for (const endpoint of [
      `/trade/accounts/${tlAcctId}/positionsHistory`,
      `/trade/accounts/${tlAcctId}/positions/history`,
      `/trade/accounts/${tlAcctId}/closedPositions`,
    ]) {
      const posHistResult = await tlRequestSafe(server, "GET", endpoint, token, undefined, accNum);
      if (!posHistResult) continue;

      const rawData = posHistResult.d?.positionsHistory || posHistResult.d?.positions ||
        posHistResult.d?.closedPositions || posHistResult.positionsHistory ||
        posHistResult.positions || posHistResult.closedPositions || [];
      const positions = Array.isArray(rawData) ? rawData : [];
      if (positions.length === 0) continue;

      console.log(`[TL] positionsHistory from ${endpoint}: ${positions.length} records`);
      usedPositionsHistory = true;

      const resCols = posHistResult.d?.columns || posHistResult.columns || configColumns.positionsHistory || [];
      const posObjects = parseColumnarData(positions, resCols);
      if (posObjects.length > 0) {
        console.log(`[TL] First posHist object keys: ${Object.keys(posObjects[0]).join(", ")}`);
        console.log(`[TL] First posHist object: ${JSON.stringify(posObjects[0]).slice(0, 400)}`);
      }

      const instIds = new Set<number>();
      for (const p of posObjects) {
        const id = Number(p.tradableInstrumentId || p.instrumentId || 0);
        if (id > 0) instIds.add(id);
      }
      const instrumentMap = await resolveInstruments(server, token, accNum, Array.from(instIds), tlAcctId!);

      for (const pos of posObjects) {
        const normalized = normalizePositionHistory(pos, instrumentMap);
        if (!normalized) continue;
        const sourceId = `pos_${normalized.broker_position_id || normalized.broker_order_id || ""}`;

        const result = await importNormalizedTrade(
          normalized, sourceId, userId, accountId, momentraAccountId, batchId, forceResync, supabaseAdmin
        );
        if (result === "imported") imported++;
        else if (result === "skipped_dupe") skippedDupes++;
        else validationFails++;
      }
      break;
    }

    // ========== PHASE 2: ordersHistory fallback ==========
    if (!usedPositionsHistory) {
      console.log("[TL] Phase 2: Using ordersHistory fallback...");

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
          console.log(`[TL] First order keys: ${Object.keys(orderObjects[0]).join(", ")}`);
          console.log(`[TL] First order: ${JSON.stringify(orderObjects[0]).slice(0, 400)}`);
        }

        // Resolve instruments
        const instIds = new Set<number>();
        for (const o of orderObjects) {
          const id = Number(o.tradableInstrumentId || o.instrumentId || 0);
          if (id > 0) instIds.add(id);
        }
        const instrumentMap = await resolveInstruments(server, token, accNum, Array.from(instIds), tlAcctId!);

        // Group orders by positionId (primary) or parentId (fallback)
        const positionGroups = new Map<string, Record<string, any>[]>();
        const standaloneOrders: Record<string, any>[] = [];

        for (const order of orderObjects) {
          // Use positionId as the primary grouping key
          const posId = order.positionId ? String(order.positionId) : null;
          const parentId = order.parentId ? String(order.parentId) : null;
          const groupKey = posId && posId !== "0" && posId !== "null" ? posId
            : (parentId && parentId !== "0" && parentId !== "null" ? parentId : null);

          if (groupKey) {
            if (!positionGroups.has(groupKey)) positionGroups.set(groupKey, []);
            positionGroups.get(groupKey)!.push(order);
          } else {
            standaloneOrders.push(order);
          }
        }

        console.log(`[TL] Grouping: ${positionGroups.size} position groups, ${standaloneOrders.length} standalone`);

        // Process grouped orders (each group = one position with entry + exit + SL/TP orders)
        for (const [groupId, groupOrders] of positionGroups) {
          // Separate filled orders from cancelled (SL/TP) orders
          const filledOrders = groupOrders.filter(o => {
            const s = String(o.status || "").toLowerCase();
            const fq = Number(o.filledQty || 0);
            return s !== "cancelled" && s !== "rejected" && s !== "expired" && fq > 0;
          });

          if (filledOrders.length === 0) continue;

          // Sort filled orders by time to identify entry vs exit
          filledOrders.sort((a, b) =>
            Number(a.createdAt || a.createdDate || 0) - Number(b.createdAt || b.createdDate || 0)
          );

          const entry = filledOrders[0];
          const exit = filledOrders.length > 1 ? filledOrders[filledOrders.length - 1] : null;

          // Pass ALL orders (including cancelled) so SL/TP can be extracted
          const normalized = normalizeGroupedOrders(entry, exit, groupOrders, instrumentMap);
          if (!normalized) continue;

          // Enhanced debug logging
          console.log(`[TL] Position ${groupId}: ${groupOrders.length} orders (${filledOrders.length} filled)`);
          console.log(`[TL]   → ${normalized.symbol} ${normalized.side} qty=${normalized.quantity} entry=${normalized.entry_price} exit=${normalized.exit_price} sl=${normalized.sl} tp=${normalized.tp} pnl=${normalized.pnl} fees=${normalized.commissions}`);

          const sourceId = `pos_${groupId}`;
          const result = await importNormalizedTrade(
            normalized, sourceId, userId, accountId, momentraAccountId, batchId, forceResync, supabaseAdmin
          );
          if (result === "imported") imported++;
          else if (result === "skipped_dupe") skippedDupes++;
          else validationFails++;
        }

        // Process standalone orders (orders with no positionId or parentId)
        for (const order of standaloneOrders) {
          const normalized = normalizeStandaloneOrder(order, instrumentMap);
          if (!normalized) continue;
          const sourceId = `ord_${normalized.broker_order_id || ""}`;

          const result = await importNormalizedTrade(
            normalized, sourceId, userId, accountId, momentraAccountId, batchId, forceResync, supabaseAdmin
          );
          if (result === "imported") imported++;
          else if (result === "skipped_dupe") skippedDupes++;
          else validationFails++;
        }
      } catch (e: any) {
        console.error("[TL] Orders history failed:", e.message);
      }
    }

    // ========== PHASE 3: Open positions ==========
    console.log("[TL] Phase 3: Fetching open positions...");
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
        const id = Number(p.tradableInstrumentId || 0);
        if (id > 0) posInstIds.add(id);
      }
      const posInstrumentMap = posInstIds.size > 0
        ? await resolveInstruments(server, token, accNum, Array.from(posInstIds), tlAcctId!)
        : new Map<number, string>();

      for (const pos of posObjects) {
        const instId = Number(pos.tradableInstrumentId || 0);
        const symbol = posInstrumentMap.get(instId) || pos.symbol || (instId > 0 ? `INST_${instId}` : "UNKNOWN");
        const sideRaw = String(pos.side || "").toLowerCase();
        const side = sideRaw.includes("buy") || sideRaw === "long" ? "Long" : "Short";
        const quantity = Math.abs(Number(pos.qty || 0));
        const entryPrice = Number(pos.avgPrice || pos.openPrice || 0);
        const openTime = msToIso(Number(pos.openTimestamp || pos.openedAt || 0));
        const posId = String(pos.id || pos.positionId || "");
        const sourceId = `openpos_${posId}`;

        if (!forceResync && sourceId !== "openpos_") {
          const { data: existing } = await supabaseAdmin
            .from("broker_activities_raw").select("id")
            .eq("source_activity_id", sourceId)
            .eq("account_id", accountId)
            .eq("source_provider", "tradelocker").maybeSingle();
          if (existing) { skippedDupes++; continue; }
        }

        await supabaseAdmin.from("broker_activities_raw").insert({
          user_id: userId, account_id: accountId, source_provider: "tradelocker",
          source_activity_id: sourceId, activity_date: openTime,
          symbol, raw_payload: pos, import_batch_id: batchId,
        });

        if (quantity <= 0) continue;

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

    // ========== PHASE 4: Reconcile open→closed positions ==========
    console.log("[TL] Phase 4: Reconciling open positions that may have been closed...");
    let reconciled = 0;
    try {
      // Find all Momentra trades that are still "open" and tagged as tradelocker open-position
      const { data: openTrades } = await supabaseAdmin.from("trades")
        .select("id, symbol, side, quantity, entry_price, open_time, tags")
        .eq("user_id", userId).eq("account_id", momentraAccountId)
        .eq("status", "open").contains("tags", ["tradelocker"]);

      if (openTrades && openTrades.length > 0) {
        // Get current open position IDs from TradeLocker (already fetched in Phase 3)
        // We need the raw position IDs from broker_activities_raw for matching
        const { data: openRawActivities } = await supabaseAdmin.from("broker_activities_raw")
          .select("source_activity_id")
          .eq("account_id", accountId).eq("source_provider", "tradelocker")
          .like("source_activity_id", "openpos_%");

        // Get current open positions from TradeLocker to know which are still open
        const currentOpenResult = await tlRequestSafe(
          server, "GET", `/trade/accounts/${tlAcctId}/positions`, token, undefined, accNum
        );
        const currentOpenRaw = currentOpenResult?.d?.positions || currentOpenResult?.positions || [];
        const currentOpenArr = Array.isArray(currentOpenRaw) ? currentOpenRaw : [];
        const currentPosCols = configColumns.positions || FALLBACK_POSITIONS_COLUMNS;
        const currentOpenObjects = parseColumnarData(currentOpenArr, currentPosCols);

        // Build set of currently open position IDs on TradeLocker
        const currentOpenPosIds = new Set<string>();
        for (const pos of currentOpenObjects) {
          const posId = String(pos.id || pos.positionId || "");
          if (posId) currentOpenPosIds.add(posId);
        }

        console.log(`[TL] Currently open on TradeLocker: ${currentOpenPosIds.size} positions`);
        console.log(`[TL] Open trades in Momentra to check: ${openTrades.length}`);

        // For each open Momentra trade, check if corresponding raw activity exists and if position is still open
        for (const trade of openTrades) {
          // Find matching raw activity to get the TradeLocker position ID
          const { data: rawActivity } = await supabaseAdmin.from("broker_activities_raw")
            .select("source_activity_id, raw_payload")
            .eq("user_id", userId).eq("account_id", accountId)
            .eq("source_provider", "tradelocker")
            .like("source_activity_id", "openpos_%")
            .limit(100);

          if (!rawActivity) continue;

          // Match by symbol + side + entry price (since we don't store position ID on the trade)
          const matchingRaw = rawActivity.find((ra: any) => {
            const payload = ra.raw_payload || {};
            const rawSymbol = payload.symbol || "";
            const rawQty = Math.abs(Number(payload.qty || 0));
            const rawEntry = Number(payload.avgPrice || payload.openPrice || 0);
            // Match by entry price proximity (within 0.01%)
            return Math.abs(rawEntry - trade.entry_price) / Math.max(trade.entry_price, 0.0001) < 0.001
              && rawQty === trade.quantity;
          });

          if (!matchingRaw) continue;

          const posIdMatch = matchingRaw.source_activity_id.replace("openpos_", "");
          if (currentOpenPosIds.has(posIdMatch)) continue; // Still open, skip

          // Position is no longer open on TradeLocker — find it in positionsHistory
          console.log(`[TL] Position ${posIdMatch} closed on TradeLocker, looking up exit details...`);

          let exitPrice: number | null = null;
          let closeTime: string | null = null;
          let realizedPnl = 0;
          let commission = 0;
          let sl: number | null = null;
          let tp: number | null = null;

          // Check positionsHistory for the closed position
          for (const endpoint of [
            `/trade/accounts/${tlAcctId}/positionsHistory`,
            `/trade/accounts/${tlAcctId}/positions/history`,
          ]) {
            const histResult = await tlRequestSafe(server, "GET", endpoint, token, undefined, accNum);
            if (!histResult) continue;

            const rawData = histResult.d?.positionsHistory || histResult.d?.positions ||
              histResult.d?.closedPositions || [];
            const histPositions = Array.isArray(rawData) ? rawData : [];
            const histCols = histResult.d?.columns || histResult.columns || [];
            const histObjects = parseColumnarData(histPositions, histCols);

            // Find matching closed position
            const closedPos = histObjects.find((p: any) => {
              const pId = String(p.id || p.positionId || "");
              return pId === posIdMatch;
            });

            if (closedPos) {
              exitPrice = Number(closedPos.closePrice || closedPos.exitPrice || closedPos.avgClosePrice || 0) || null;
              closeTime = msToIso(Number(closedPos.closeTimestamp || closedPos.closedAt || closedPos.lastModifiedAt || 0));
              realizedPnl = Number(closedPos.pnl || closedPos.profit || 0);
              commission = Math.abs(Number(closedPos.commission || closedPos.fee || 0));
              sl = Number(closedPos.stopLoss || 0) || null;
              tp = Number(closedPos.takeProfit || 0) || null;
              const swap = Number(closedPos.swap || 0);
              realizedPnl = realizedPnl - commission + swap;
              console.log(`[TL] Found closed position: exit=${exitPrice} pnl=${realizedPnl} closeTime=${closeTime}`);
              break;
            }
          }

          // If we couldn't find it in positionsHistory, still mark as closed
          if (!exitPrice && !closeTime) {
            console.log(`[TL] Position ${posIdMatch} not found in history, marking closed with calculated PnL`);
            closeTime = new Date().toISOString();
          }

          // Update the trade in Momentra
          const updateData: Record<string, any> = {
            status: "closed",
            close_time: closeTime || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          if (exitPrice) updateData.exit_price = exitPrice;
          if (realizedPnl !== 0) updateData.pnl = realizedPnl;
          if (commission > 0) updateData.commissions = commission;
          if (sl) updateData.sl = sl;
          if (tp) updateData.tp = tp;
          // Update tags to remove open-position
          const newTags = (trade.tags || []).filter((t: string) => t !== "open-position");
          newTags.push("auto-closed");
          updateData.tags = newTags;

          await supabaseAdmin.from("trades").update(updateData).eq("id", trade.id);
          console.log(`[TL] ✓ Reconciled trade ${trade.id} (${trade.symbol}) as closed`);
          reconciled++;
        }
      }
    } catch (e: any) {
      console.error("[TL] Reconciliation phase failed:", e.message);
    }

    // ========== COMPLETE ==========
    const syncStatus = imported > 0 || reconciled > 0 ? "completed" : "completed_no_data";
    console.log(`[TL] === SYNC SUMMARY ===`);
    console.log(`[TL]   Method: ${usedPositionsHistory ? "positionsHistory" : "ordersHistory (grouped)"}`);
    console.log(`[TL]   Force resync: ${forceResync}`);
    console.log(`[TL]   Imported: ${imported} (${imported - positionsImported} closed, ${positionsImported} open)`);
    console.log(`[TL]   Reconciled (open→closed): ${reconciled}`);
    console.log(`[TL]   Duplicates skipped: ${skippedDupes}`);
    console.log(`[TL]   Validation failures: ${validationFails}`);

    await supabaseAdmin.from("sync_jobs").update({
      status: syncStatus, completed_at: new Date().toISOString(),
      activities_imported: imported,
      meta: {
        phase: "complete", method: usedPositionsHistory ? "positionsHistory" : "ordersHistory",
        force_resync: forceResync,
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
        if (!serverName) throw new Error("Server name is required");
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
      case "force_resync":
        result = await syncAccount(userId, body.account_id, "force_resync", supabaseAdmin);
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
