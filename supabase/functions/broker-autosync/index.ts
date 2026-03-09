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

async function syncTradeLockerAccount(
  userId: string,
  integration: any,
  brokerAccount: any,
  supabaseAdmin: any
) {
  const token = await getValidToken(integration, supabaseAdmin);
  const server = integration.tradelocker_server;
  const tlAcctId = brokerAccount.tradelocker_account_id;
  let imported = 0;

  // Create sync job
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
    // Fetch order history (pass accNum header)
    const ordersResult = await tlRequest(
      server, "GET", `/trade/accounts/${tlAcctId}/ordersHistory`, token, undefined, tlAcctId
    );
    const orders = ordersResult.d?.ordersHistory || ordersResult.orders || ordersResult || [];

    for (const order of (Array.isArray(orders) ? orders : [])) {
      const sourceId = String(order.id || order.orderId || "");

      // Dedupe check
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

      // Insert raw activity
      await supabaseAdmin.from("broker_activities_raw").insert({
        user_id: userId,
        account_id: brokerAccount.id,
        source_provider: "tradelocker",
        source_activity_id: sourceId,
        activity_date: order.filledAt || order.createdAt || null,
        symbol: order.tradableInstrument?.symbol || order.symbol || null,
        raw_payload: order,
        import_batch_id: batchId,
      });

      // Normalize into trade
      const symbol = order.tradableInstrument?.symbol || order.symbol || order.instrument || "UNKNOWN";
      const side = (order.side || order.type || "").toLowerCase().includes("buy") ? "Long" : "Short";
      const quantity = Math.abs(Number(order.filledQty || order.qty || order.quantity || 0));
      const price = Number(order.avgFilledPrice || order.price || 0);
      const pnl = Number(order.pnl || order.profit || 0);
      const fees = Math.abs(Number(order.commission || order.fee || 0));
      const tradeDate = order.filledAt || order.createdAt || null;

      const { data: momentraAccounts } = await supabaseAdmin
        .from("accounts")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      const momentraAccountId = momentraAccounts?.[0]?.id;
      if (!momentraAccountId) continue;

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
        tags: ["broker-import", "tradelocker", "auto-sync"],
        note: "Auto-synced from TradeLocker",
      });

      imported++;
    }

    // Complete sync job
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
      .eq("id", brokerAccount.connection_id);

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
      // Get selected broker accounts for this integration
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
