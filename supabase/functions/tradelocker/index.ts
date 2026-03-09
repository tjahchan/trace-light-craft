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

  console.log(`[TradeLocker] ${method} ${path} (accNum: ${accNum || "none"})`);

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[TradeLocker] ${method} ${path} failed:`, res.status, errText);
    throw new Error(`TradeLocker API error: ${res.status} - ${errText}`);
  }

  return res.json();
}

// Helper: resolve accNum for a given accountId from the all-accounts endpoint
async function resolveAccNum(
  server: string,
  token: string,
  targetAccountId: string
): Promise<string> {
  const accountsResult = await tlRequest(server, "GET", "/auth/jwt/all-accounts", token);
  console.log("[TradeLocker] all-accounts raw keys:", Object.keys(accountsResult));

  // Parse accounts - could be flat array or nested { demo: [...], live: [...] }
  let allAccounts: any[] = [];
  const raw = accountsResult.accounts || accountsResult;

  if (Array.isArray(raw)) {
    allAccounts = raw;
  } else if (typeof raw === "object" && raw !== null) {
    // Nested by environment (demo/live)
    for (const env of Object.keys(raw)) {
      const envAccounts = raw[env];
      if (Array.isArray(envAccounts)) {
        allAccounts.push(...envAccounts);
      }
    }
  }

  console.log(`[TradeLocker] Found ${allAccounts.length} accounts from API`);

  for (const acct of allAccounts) {
    const acctId = String(acct.id || acct.accountId || "");
    const accNum = String(acct.accNum ?? acct.acc_num ?? "");
    console.log(`[TradeLocker] Account id=${acctId} accNum=${accNum} name=${acct.name || acct.accountName || ""}`);

    if (acctId === targetAccountId) {
      if (accNum) return accNum;
      // If accNum not present, try the id itself
      return acctId;
    }
  }

  // Fallback: if only one account, use its accNum
  if (allAccounts.length === 1) {
    const only = allAccounts[0];
    const accNum = String(only.accNum ?? only.acc_num ?? only.id ?? "");
    console.log(`[TradeLocker] Single account fallback, using accNum=${accNum}`);
    return accNum;
  }

  console.warn(`[TradeLocker] Could not find accNum for accountId=${targetAccountId}, falling back to accountId`);
  return targetAccountId;
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
    email,
    password,
    server: serverName,
  });

  const accessToken = authResult.accessToken || authResult.access_token;
  const refreshToken = authResult.refreshToken || authResult.refresh_token;
  const expiresIn = authResult.expiresIn || authResult.expires_in || 3600;

  if (!accessToken || !refreshToken) {
    throw new Error("Authentication failed. Please check your credentials and server.");
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Check existing integration
  const { data: existing } = await supabaseAdmin
    .from("broker_integrations")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "tradelocker")
    .maybeSingle();

  let integrationId: string;

  if (existing) {
    await supabaseAdmin
      .from("broker_integrations")
      .update({
        tradelocker_server: environment,
        tradelocker_access_token_encrypted: accessToken,
        tradelocker_refresh_token_encrypted: refreshToken,
        tradelocker_token_expires_at: expiresAt,
        status: "active",
      })
      .eq("id", existing.id);
    integrationId = existing.id;
  } else {
    const { data: newInt, error } = await supabaseAdmin
      .from("broker_integrations")
      .insert({
        user_id: userId,
        provider: "tradelocker",
        tradelocker_server: environment,
        tradelocker_access_token_encrypted: accessToken,
        tradelocker_refresh_token_encrypted: refreshToken,
        tradelocker_token_expires_at: expiresAt,
        status: "active",
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to save integration: ${error.message}`);
    integrationId = newInt.id;
  }

  // Create or update broker connection
  const { data: existingConn } = await supabaseAdmin
    .from("broker_connections")
    .select("id")
    .eq("integration_id", integrationId)
    .eq("user_id", userId)
    .maybeSingle();

  let connectionId: string;
  if (existingConn) {
    await supabaseAdmin
      .from("broker_connections")
      .update({
        broker_name: "TradeLocker",
        connection_status: "connected",
        disabled: false,
        provider: "tradelocker",
      })
      .eq("id", existingConn.id);
    connectionId = existingConn.id;
  } else {
    const { data: newConn } = await supabaseAdmin
      .from("broker_connections")
      .insert({
        user_id: userId,
        integration_id: integrationId,
        broker_name: "TradeLocker",
        connection_status: "connected",
        provider: "tradelocker",
      })
      .select()
      .single();
    connectionId = newConn!.id;
  }

  // Immediately discover accounts after authentication
  console.log("[TradeLocker] Post-auth: discovering accounts...");
  try {
    await listAccounts(userId, supabaseAdmin);
  } catch (e: any) {
    console.warn("[TradeLocker] Post-auth account discovery failed:", e.message);
  }

  return { success: true, integration_id: integrationId, connection_id: connectionId };
}

async function refreshAccessToken(
  integration: any,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
  const server = integration.tradelocker_server;
  const refreshToken = integration.tradelocker_refresh_token_encrypted;

  const result = await tlRequest(server, "POST", "/auth/jwt/refresh", undefined, {
    refreshToken,
  });

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

async function getValidToken(
  integration: any,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
): Promise<string> {
  const expiresAt = integration.tradelocker_token_expires_at
    ? new Date(integration.tradelocker_token_expires_at)
    : null;

  if (!expiresAt || expiresAt.getTime() - Date.now() < 60000) {
    return await refreshAccessToken(integration, supabaseAdmin);
  }

  return integration.tradelocker_access_token_encrypted;
}

async function listAccounts(
  userId: string,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
  const { data: integration } = await supabaseAdmin
    .from("broker_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "tradelocker")
    .single();

  if (!integration) return { accounts: [] };

  const token = await getValidToken(integration, supabaseAdmin);
  const server = integration.tradelocker_server;

  // Fetch accounts
  const accountsResult = await tlRequest(server, "GET", "/auth/jwt/all-accounts", token);
  console.log("[TradeLocker] all-accounts response keys:", Object.keys(accountsResult));

  // Parse accounts - handle both flat array and nested object
  let accounts: any[] = [];
  const raw = accountsResult.accounts || accountsResult;

  if (Array.isArray(raw)) {
    accounts = raw;
  } else if (typeof raw === "object" && raw !== null) {
    for (const env of Object.keys(raw)) {
      const envAccounts = raw[env];
      if (Array.isArray(envAccounts)) {
        accounts.push(...envAccounts);
      }
    }
  }

  console.log(`[TradeLocker] Parsed ${accounts.length} accounts`);

  // Get connection
  const { data: conn } = await supabaseAdmin
    .from("broker_connections")
    .select("id")
    .eq("integration_id", integration.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn) return { accounts: [] };

  // Sync accounts to DB
  for (const acct of accounts) {
    const tlAccountId = String(acct.id || acct.accountId || acct.account_id || "");
    const tlAccNum = String(acct.accNum ?? acct.acc_num ?? "");
    const accountName = acct.name || acct.accountName || `Account ${tlAccountId}`;
    const accountNumber = acct.accountNumber || acct.number || tlAccountId;
    const accountType = acct.type || acct.accountType || null;
    const currency = acct.currency || "USD";

    console.log(`[TradeLocker] Account: id=${tlAccountId} accNum=${tlAccNum} name=${accountName}`);

    const { data: existing } = await supabaseAdmin
      .from("broker_accounts")
      .select("id")
      .eq("tradelocker_account_id", tlAccountId)
      .eq("user_id", userId)
      .maybeSingle();

    // Store accNum in account_number_masked as "accnum:X" prefix for retrieval during sync
    const maskedNumber = tlAccNum
      ? `accnum:${tlAccNum}|${accountNumber.length > 4 ? `***${accountNumber.slice(-4)}` : accountNumber}`
      : (accountNumber.length > 4 ? `***${accountNumber.slice(-4)}` : accountNumber);

    const accountData = {
      broker_name: "TradeLocker",
      account_name: accountName,
      account_type: accountType,
      account_number_masked: maskedNumber,
      currency,
      provider: "tradelocker",
    };

    if (existing) {
      await supabaseAdmin.from("broker_accounts").update(accountData).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("broker_accounts").insert({
        user_id: userId,
        connection_id: conn.id,
        tradelocker_account_id: tlAccountId,
        ...accountData,
      });
    }
  }

  // Return DB accounts
  const { data: dbAccounts } = await supabaseAdmin
    .from("broker_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "tradelocker")
    .order("created_at", { ascending: false });

  return { accounts: dbAccounts || [] };
}

async function selectAccounts(
  userId: string,
  accountIds: string[],
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
  for (const id of accountIds) {
    await supabaseAdmin
      .from("broker_accounts")
      .update({ is_selected_for_import: true })
      .eq("id", id)
      .eq("user_id", userId);
  }
  return { selected: accountIds.length };
}

// Extract stored accNum from account_number_masked field
function extractStoredAccNum(accountNumberMasked: string | null): string | null {
  if (!accountNumberMasked) return null;
  const match = accountNumberMasked.match(/^accnum:(\d+)\|/);
  return match ? match[1] : null;
}

async function syncAccount(
  userId: string,
  accountId: string,
  jobType: string,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
  const { data: integration } = await supabaseAdmin
    .from("broker_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "tradelocker")
    .single();

  if (!integration) throw new Error("No TradeLocker integration found");

  const { data: brokerAccount } = await supabaseAdmin
    .from("broker_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  if (!brokerAccount) throw new Error("Broker account not found");

  const token = await getValidToken(integration, supabaseAdmin);
  const server = integration.tradelocker_server;
  const tlAcctId = brokerAccount.tradelocker_account_id;

  // Resolve accNum - first try stored value, then fetch from API
  let accNum = extractStoredAccNum(brokerAccount.account_number_masked);
  if (!accNum) {
    console.log("[TradeLocker] No stored accNum, fetching from API...");
    accNum = await resolveAccNum(server, token, tlAcctId!);
    // Store it for future use
    const masked = brokerAccount.account_number_masked || "";
    await supabaseAdmin
      .from("broker_accounts")
      .update({ account_number_masked: `accnum:${accNum}|${masked}` })
      .eq("id", accountId);
  }

  console.log(`[TradeLocker] Sync: accountId=${tlAcctId} accNum=${accNum} jobType=${jobType}`);

  // Create sync job
  const { data: job } = await supabaseAdmin
    .from("sync_jobs")
    .insert({
      user_id: userId,
      connection_id: brokerAccount.connection_id,
      account_id: accountId,
      job_type: jobType,
      status: "running",
      started_at: new Date().toISOString(),
      meta: { phase: "fetching_history" },
    })
    .select()
    .single();

  const batchId = job?.id || crypto.randomUUID();

  try {
    let imported = 0;
    let skippedDupes = 0;

    // ---- PHASE 1: Fetch closed order history ----
    console.log("[TradeLocker] Phase 1: Fetching order history...");
    await supabaseAdmin.from("sync_jobs").update({ meta: { phase: "fetching_history" } }).eq("id", job?.id);

    try {
      const ordersResult = await tlRequest(
        server,
        "GET",
        `/trade/accounts/${tlAcctId}/ordersHistory`,
        token,
        undefined,
        accNum
      );

      const rawOrders = ordersResult.d?.ordersHistory || ordersResult.d?.orders || ordersResult.orders || ordersResult;
      const orders = Array.isArray(rawOrders) ? rawOrders : [];
      console.log(`[TradeLocker] Orders history: ${orders.length} records fetched`);

      await supabaseAdmin.from("sync_jobs").update({ meta: { phase: "importing_trades", orders_found: orders.length } }).eq("id", job?.id);

      // Get user's Momentra account
      const { data: momentraAccounts } = await supabaseAdmin
        .from("accounts")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      const momentraAccountId = momentraAccounts?.[0]?.id;

      for (const order of orders) {
        const sourceId = String(order.id || order.orderId || order.order_id || "");

        // Dedupe
        if (sourceId) {
          const { data: existing } = await supabaseAdmin
            .from("broker_activities_raw")
            .select("id")
            .eq("source_activity_id", sourceId)
            .eq("account_id", accountId)
            .eq("source_provider", "tradelocker")
            .maybeSingle();

          if (existing) {
            skippedDupes++;
            continue;
          }
        }

        // Insert raw
        await supabaseAdmin.from("broker_activities_raw").insert({
          user_id: userId,
          account_id: accountId,
          source_provider: "tradelocker",
          source_activity_id: sourceId,
          activity_date: order.filledAt || order.createdAt || order.created_at || null,
          symbol: order.tradableInstrument?.symbol || order.symbol || null,
          raw_payload: order,
          import_batch_id: batchId,
        });

        if (!momentraAccountId) continue;

        // Normalize into trade
        const symbol = order.tradableInstrument?.symbol || order.symbol || order.instrument || "UNKNOWN";
        const side = (order.side || order.type || "").toLowerCase().includes("buy") ? "Long" : "Short";
        const quantity = Math.abs(Number(order.filledQty || order.qty || order.quantity || 0));
        const price = Number(order.avgFilledPrice || order.price || 0);
        const pnl = Number(order.pnl || order.profit || 0);
        const fees = Math.abs(Number(order.commission || order.fee || 0));
        const tradeDate = order.filledAt || order.createdAt || null;

        await supabaseAdmin.from("trades").insert({
          user_id: userId,
          account_id: momentraAccountId,
          symbol,
          side,
          quantity,
          entry_price: price,
          exit_price: null,
          pnl: pnl - fees,
          commissions: fees,
          open_time: tradeDate,
          close_time: tradeDate,
          status: "closed",
          tags: ["broker-import", "tradelocker"],
          note: `Imported from TradeLocker`,
        });

        imported++;
      }
    } catch (e: any) {
      console.error("[TradeLocker] Orders history fetch failed:", e.message);
    }

    // ---- PHASE 2: Fetch open positions ----
    console.log("[TradeLocker] Phase 2: Fetching open positions...");
    await supabaseAdmin.from("sync_jobs").update({ meta: { phase: "importing_positions" } }).eq("id", job?.id);

    let positionsImported = 0;
    try {
      const posResult = await tlRequest(
        server,
        "GET",
        `/trade/accounts/${tlAcctId}/positions`,
        token,
        undefined,
        accNum
      );
      const rawPositions = posResult.d?.positions || posResult.positions || posResult;
      const positions = Array.isArray(rawPositions) ? rawPositions : [];
      console.log(`[TradeLocker] Positions: ${positions.length} open positions found`);

      const { data: momentraAccounts } = await supabaseAdmin
        .from("accounts")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      const momentraAccountId = momentraAccounts?.[0]?.id;

      for (const pos of positions) {
        const sourceId = `pos_${pos.id || pos.positionId || ""}`;

        const { data: existing } = await supabaseAdmin
          .from("broker_activities_raw")
          .select("id")
          .eq("source_activity_id", sourceId)
          .eq("account_id", accountId)
          .eq("source_provider", "tradelocker")
          .maybeSingle();

        if (existing) {
          skippedDupes++;
          continue;
        }

        await supabaseAdmin.from("broker_activities_raw").insert({
          user_id: userId,
          account_id: accountId,
          source_provider: "tradelocker",
          source_activity_id: sourceId,
          activity_date: pos.openedAt || pos.created_at || null,
          symbol: pos.tradableInstrument?.symbol || pos.symbol || null,
          raw_payload: pos,
          import_batch_id: batchId,
        });

        if (!momentraAccountId) continue;

        const symbol = pos.tradableInstrument?.symbol || pos.symbol || "UNKNOWN";
        const side = (pos.side || "").toLowerCase().includes("buy") ? "Long" : "Short";
        const quantity = Math.abs(Number(pos.qty || pos.quantity || 0));
        const entryPrice = Number(pos.avgPrice || pos.openPrice || pos.price || 0);
        const unrealizedPnl = Number(pos.unrealizedPnl || pos.pnl || 0);

        await supabaseAdmin.from("trades").insert({
          user_id: userId,
          account_id: momentraAccountId,
          symbol,
          side,
          quantity,
          entry_price: entryPrice,
          pnl: unrealizedPnl,
          open_time: pos.openedAt || pos.created_at || null,
          status: "open",
          tags: ["broker-import", "tradelocker", "open-position"],
          note: `Open position imported from TradeLocker`,
        });

        positionsImported++;
        imported++;
      }
    } catch (e: any) {
      console.error("[TradeLocker] Positions fetch failed:", e.message);
    }

    // ---- Sync complete ----
    const syncStatus = imported > 0 ? "completed" : "completed_no_data";
    console.log(`[TradeLocker] Sync complete: ${imported} imported, ${skippedDupes} duplicates skipped, ${positionsImported} positions`);

    await supabaseAdmin
      .from("sync_jobs")
      .update({
        status: syncStatus,
        completed_at: new Date().toISOString(),
        activities_imported: imported,
        meta: {
          phase: "complete",
          closed_trades: imported - positionsImported,
          open_positions: positionsImported,
          duplicates_skipped: skippedDupes,
        },
      })
      .eq("id", job?.id);

    // Update last_synced_at
    await supabaseAdmin
      .from("broker_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", brokerAccount.connection_id);

    return { success: true, imported, job_id: job?.id };
  } catch (err: any) {
    console.error("[TradeLocker] Sync failed:", err.message);
    await supabaseAdmin
      .from("sync_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: err.message,
        meta: { phase: "failed" },
      })
      .eq("id", job?.id);
    throw err;
  }
}

async function disconnectConnection(
  userId: string,
  connectionId: string,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
  await supabaseAdmin
    .from("broker_connections")
    .update({ connection_status: "disconnected", disabled: true })
    .eq("id", connectionId)
    .eq("user_id", userId);

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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const body = req.method === "GET" ? {} : await req.json();
    const action = body.action || new URL(req.url).searchParams.get("action");

    let result: unknown;

    switch (action) {
      case "authenticate": {
        if (!body.email || !body.password) {
          throw new Error("Email and password are required");
        }
        const environment = body.environment || "demo.tradelocker.com";
        const serverName = body.server_name || body.server || "";
        if (!serverName) {
          throw new Error("Server name is required (e.g. BLBRY, FTMO)");
        }
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
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[TradeLocker Edge Function] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
