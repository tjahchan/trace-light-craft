// SnapTrade broker integration edge function
// Handles all server-side SnapTrade API operations
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SNAPTRADE_BASE_URL = "https://api.snaptrade.com/api/v1";

function getSnapTradeConfig() {
  const clientId = Deno.env.get("SNAPTRADE_CLIENT_ID");
  const consumerKey = Deno.env.get("SNAPTRADE_CONSUMER_KEY");
  if (!clientId || !consumerKey) {
    throw new Error("SnapTrade credentials not configured. Add SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY as secrets.");
  }
  return { clientId, consumerKey };
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Generate SnapTrade HMAC-SHA256 signature
async function generateSignature(
  consumerKey: string,
  requestData: Record<string, unknown> | undefined,
  requestPath: string,
  requestQuery: string
): Promise<string> {
  const sigObject = {
    content: requestData || {},
    path: requestPath,
    query: requestQuery,
  };
  // SnapTrade requires sorted keys and no spaces (compact JSON)
  const sigContent = JSON.stringify(sigObject, Object.keys(sigObject).sort());

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(consumerKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(sigContent)
  );

  // Convert to base64
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// SnapTrade API request helper with HMAC signature
async function snapTradeRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>
) {
  const { clientId, consumerKey } = getSnapTradeConfig();

  // Build query string
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = new URLSearchParams();
  params.set("clientId", clientId);
  params.set("timestamp", timestamp);
  if (queryParams) {
    Object.entries(queryParams).forEach(([k, v]) => params.set(k, v));
  }

  const queryString = params.toString();
  const fullUrl = `${SNAPTRADE_BASE_URL}${path}?${queryString}`;

  // Generate HMAC signature
  const signature = await generateSignature(consumerKey, body, `/api/v1${path}`, queryString);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Signature": signature,
  };

  console.log(`[SnapTrade] ${method} ${path} (query: ${queryString})`);

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[SnapTrade] ${method} ${path} failed:`, res.status, errText);
    throw new Error(`SnapTrade API error: ${res.status} - ${errText}`);
  }

  return res.json();
}

// ---- Action Handlers ----

async function registerUser(userId: string, supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  // Check if integration already exists
  const { data: existing } = await supabaseAdmin
    .from("broker_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "snaptrade")
    .maybeSingle();

  if (existing?.snaptrade_user_id) {
    return { snaptrade_user_id: existing.snaptrade_user_id, integration_id: existing.id, already_exists: true };
  }

  // Register with SnapTrade
  const snapUserId = `momentra_${userId.replace(/-/g, "").slice(0, 20)}`;

  const result = await snapTradeRequest("POST", "/snapTrade/registerUser", {
    userId: snapUserId,
  });

  const snapUserSecret = result?.userSecret || result?.user_secret || "";

  // Save integration record (secrets stored server-side only)
  if (existing) {
    await supabaseAdmin
      .from("broker_integrations")
      .update({
        snaptrade_user_id: snapUserId,
        snaptrade_user_secret_encrypted: snapUserSecret,
        status: "active",
      })
      .eq("id", existing.id);
    return { snaptrade_user_id: snapUserId, integration_id: existing.id, already_exists: false };
  }

  const { data: newIntegration, error } = await supabaseAdmin
    .from("broker_integrations")
    .insert({
      user_id: userId,
      provider: "snaptrade",
      snaptrade_user_id: snapUserId,
      snaptrade_user_secret_encrypted: snapUserSecret,
      status: "active",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save integration: ${error.message}`);

  return { snaptrade_user_id: snapUserId, integration_id: newIntegration.id, already_exists: false };
}

async function generateConnectUrl(userId: string, supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, redirectUri: string) {
  // Get integration
  const { data: integration } = await supabaseAdmin
    .from("broker_integrations")
    .select("snaptrade_user_id, snaptrade_user_secret_encrypted")
    .eq("user_id", userId)
    .eq("provider", "snaptrade")
    .single();

  if (!integration?.snaptrade_user_id) {
    throw new Error("No SnapTrade user registered. Call register first.");
  }

  // POST /api/v1/snapTrade/login — userId and userSecret go as query params
  const result = await snapTradeRequest("POST", "/snapTrade/login",
    redirectUri ? { customRedirect: redirectUri } : {},
    {
      userId: integration.snaptrade_user_id,
      userSecret: integration.snaptrade_user_secret_encrypted || "",
    }
  );

  return {
    redirect_url: result?.loginLink || result?.redirectURI || result?.url || "",
  };
}

async function listConnections(userId: string, supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  const { data: integration } = await supabaseAdmin
    .from("broker_integrations")
    .select("snaptrade_user_id, snaptrade_user_secret_encrypted, id")
    .eq("user_id", userId)
    .eq("provider", "snaptrade")
    .single();

  if (!integration?.snaptrade_user_id) {
    return { connections: [] };
  }

  // Fetch from SnapTrade
  const connections = await snapTradeRequest("GET", "/authorizations", undefined, {
    userId: integration.snaptrade_user_id,
    userSecret: integration.snaptrade_user_secret_encrypted || "",
  });

  // Sync to database
  const results = [];
  for (const conn of (connections || [])) {
    const brokerName = conn.brokerage?.name || conn.broker_name || "Unknown Broker";
    const connId = conn.id || conn.connection_id;
    const status = conn.disabled ? "needs_reconnect" : "connected";

    const { data: existingConn } = await supabaseAdmin
      .from("broker_connections")
      .select("id")
      .eq("snaptrade_connection_id", connId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingConn) {
      await supabaseAdmin
        .from("broker_connections")
        .update({ broker_name: brokerName, connection_status: status, disabled: !!conn.disabled })
        .eq("id", existingConn.id);
      results.push({ ...existingConn, broker_name: brokerName, connection_status: status });
    } else {
      const { data: newConn } = await supabaseAdmin
        .from("broker_connections")
        .insert({
          user_id: userId,
          integration_id: integration.id,
          snaptrade_connection_id: connId,
          broker_name: brokerName,
          connection_status: status,
          disabled: !!conn.disabled,
        })
        .select()
        .single();
      results.push(newConn);
    }
  }

  // Return all DB connections for this user
  const { data: dbConns } = await supabaseAdmin
    .from("broker_connections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return { connections: dbConns || [] };
}

async function listAccounts(userId: string, supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  const { data: integration } = await supabaseAdmin
    .from("broker_integrations")
    .select("snaptrade_user_id, snaptrade_user_secret_encrypted")
    .eq("user_id", userId)
    .eq("provider", "snaptrade")
    .single();

  if (!integration?.snaptrade_user_id) {
    return { accounts: [] };
  }

  const accounts = await snapTradeRequest("GET", "/accounts", undefined, {
    userId: integration.snaptrade_user_id,
    userSecret: integration.snaptrade_user_secret_encrypted || "",
  });

  // Sync to database
  for (const acct of (accounts || [])) {
    const snapAcctId = acct.id || acct.account_id;
    const connectionId = acct.brokerage_authorization || acct.connection_id;

    // Find the broker_connection row
    const { data: connRow } = await supabaseAdmin
      .from("broker_connections")
      .select("id, broker_name")
      .eq("snaptrade_connection_id", connectionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!connRow) continue;

    const { data: existing } = await supabaseAdmin
      .from("broker_accounts")
      .select("id")
      .eq("snaptrade_account_id", snapAcctId)
      .eq("user_id", userId)
      .maybeSingle();

    const accountData = {
      broker_name: connRow.broker_name || acct.institution_name || "Unknown",
      account_name: acct.name || acct.account_name || "Account",
      account_type: acct.type || acct.account_type || null,
      account_number_masked: acct.number ? `***${acct.number.slice(-4)}` : null,
      currency: acct.currency?.code || acct.currency || "USD",
    };

    if (existing) {
      await supabaseAdmin.from("broker_accounts").update(accountData).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("broker_accounts").insert({
        user_id: userId,
        connection_id: connRow.id,
        snaptrade_account_id: snapAcctId,
        ...accountData,
      });
    }
  }

  // Return all DB accounts
  const { data: dbAccounts } = await supabaseAdmin
    .from("broker_accounts")
    .select("*, broker_connections!inner(broker_name, connection_status)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return { accounts: dbAccounts || [] };
}

async function selectAccounts(userId: string, accountIds: string[], supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  // Mark selected accounts
  for (const id of accountIds) {
    await supabaseAdmin
      .from("broker_accounts")
      .update({ is_selected_for_import: true })
      .eq("id", id)
      .eq("user_id", userId);
  }
  return { selected: accountIds.length };
}

async function syncActivities(
  userId: string,
  accountId: string,
  jobType: string,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
  const { data: integration } = await supabaseAdmin
    .from("broker_integrations")
    .select("snaptrade_user_id, snaptrade_user_secret_encrypted")
    .eq("user_id", userId)
    .eq("provider", "snaptrade")
    .single();

  if (!integration?.snaptrade_user_id) throw new Error("No SnapTrade integration found");

  const { data: brokerAccount } = await supabaseAdmin
    .from("broker_accounts")
    .select("*, broker_connections!inner(id, snaptrade_connection_id)")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  if (!brokerAccount) throw new Error("Broker account not found");

  // Create sync job
  const { data: job } = await supabaseAdmin
    .from("sync_jobs")
    .insert({
      user_id: userId,
      connection_id: (brokerAccount as any).broker_connections?.id || (brokerAccount as any).connection_id,
      account_id: accountId,
      job_type: jobType,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  const batchId = job?.id || crypto.randomUUID();

  try {
    // Fetch activities from SnapTrade
    // TODO: Add pagination support for large activity sets
    const activities = await snapTradeRequest(
      "GET",
      `/accounts/${brokerAccount.snaptrade_account_id}/activities`,
      undefined,
      {
        userId: integration.snaptrade_user_id,
        userSecret: integration.snaptrade_user_secret_encrypted || "",
      }
    );

    let imported = 0;

    for (const activity of (activities || [])) {
      const sourceActivityId = activity.id || activity.activity_id || null;

      // Deduplicate check
      if (sourceActivityId) {
        const { data: existing } = await supabaseAdmin
          .from("broker_activities_raw")
          .select("id")
          .eq("source_activity_id", sourceActivityId)
          .eq("account_id", accountId)
          .eq("source_provider", "snaptrade")
          .maybeSingle();

        if (existing) continue;
      }

      // Insert raw activity
      await supabaseAdmin.from("broker_activities_raw").insert({
        user_id: userId,
        account_id: accountId,
        source_provider: "snaptrade",
        source_activity_id: sourceActivityId,
        activity_date: activity.trade_date || activity.settlement_date || activity.date || null,
        symbol: activity.symbol?.symbol || activity.symbol || null,
        raw_payload: activity,
        import_batch_id: batchId,
      });

      // Normalize into trades table
      const symbol = activity.symbol?.symbol || activity.symbol || activity.description || "UNKNOWN";
      const side = (activity.type || activity.action || "").toUpperCase().includes("BUY") ? "Long" : "Short";
      const quantity = Math.abs(Number(activity.units || activity.quantity || activity.amount || 0));
      const price = Number(activity.price || activity.unit_amount || 0);
      const fees = Math.abs(Number(activity.fee || activity.commission || 0));
      const tradeDate = activity.trade_date || activity.settlement_date || activity.date || null;

      // Get user's selected Momentra account for this broker account
      // For now, we'll create trades that can be linked later
      // TODO: Allow user to map broker accounts to Momentra accounts
      const { data: momentraAccounts } = await supabaseAdmin
        .from("accounts")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      const momentraAccountId = momentraAccounts?.[0]?.id;
      if (!momentraAccountId) continue;

      // Insert normalized trade
      await supabaseAdmin.from("trades").insert({
        user_id: userId,
        account_id: momentraAccountId,
        symbol,
        side,
        quantity,
        entry_price: price,
        exit_price: null,
        pnl: Number(activity.amount || 0) - fees,
        commissions: fees,
        open_time: tradeDate,
        close_time: tradeDate,
        status: "closed",
        tags: ["broker-import"],
        note: `Imported from ${brokerAccount.broker_name || "broker"} via SnapTrade`,
      });

      imported++;
    }

    // Update sync job
    await supabaseAdmin
      .from("sync_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        activities_imported: imported,
      })
      .eq("id", job?.id);

    // Update last_synced_at
    await supabaseAdmin
      .from("broker_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", (brokerAccount as any).connection_id);

    return { success: true, imported, job_id: job?.id };
  } catch (err: any) {
    await supabaseAdmin
      .from("sync_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: err.message,
      })
      .eq("id", job?.id);

    throw err;
  }
}

async function disconnectConnection(userId: string, connectionId: string, supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  const { data: conn } = await supabaseAdmin
    .from("broker_connections")
    .select("snaptrade_connection_id, integration_id")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .single();

  if (!conn) throw new Error("Connection not found");

  const { data: integration } = await supabaseAdmin
    .from("broker_integrations")
    .select("snaptrade_user_id, snaptrade_user_secret_encrypted")
    .eq("id", conn.integration_id)
    .single();

  if (integration?.snaptrade_user_id && conn.snaptrade_connection_id) {
    try {
      // TODO: Call SnapTrade delete connection endpoint
      await snapTradeRequest(
        "DELETE",
        `/connections/${conn.snaptrade_connection_id}`,
        undefined,
        {
          userId: integration.snaptrade_user_id,
          userSecret: integration.snaptrade_user_secret_encrypted || "",
        }
      );
    } catch (e) {
      console.warn("[SnapTrade] Disconnect API call failed (may already be disconnected):", e);
    }
  }

  // Update DB
  await supabaseAdmin
    .from("broker_connections")
    .update({ connection_status: "disconnected", disabled: true })
    .eq("id", connectionId);

  return { success: true };
}

// ---- Main Handler ----
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "GET" ? {} : await req.json();
    const action = body.action || new URL(req.url).searchParams.get("action");

    let result: unknown;

    switch (action) {
      case "register":
        result = await registerUser(user.id, supabaseAdmin);
        break;
      case "connect_url":
        result = await generateConnectUrl(user.id, supabaseAdmin, body.redirect_uri || "");
        break;
      case "list_connections":
        result = await listConnections(user.id, supabaseAdmin);
        break;
      case "list_accounts":
        result = await listAccounts(user.id, supabaseAdmin);
        break;
      case "select_accounts":
        result = await selectAccounts(user.id, body.account_ids || [], supabaseAdmin);
        break;
      case "sync":
        result = await syncActivities(user.id, body.account_id, body.job_type || "manual_sync", supabaseAdmin);
        break;
      case "disconnect":
        result = await disconnectConnection(user.id, body.connection_id, supabaseAdmin);
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
    console.error("[SnapTrade Edge Function] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
