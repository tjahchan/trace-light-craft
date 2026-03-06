import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Unplug,
  ChevronRight,
  Clock,
  Shield,
  Activity,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";
import { BrokerConnectionCard } from "@/components/broker/BrokerConnectionCard";
import { AccountSelectionModal } from "@/components/broker/AccountSelectionModal";
import { SyncStatusBanner } from "@/components/broker/SyncStatusBanner";
import {
  registerSnapTradeUser,
  generateConnectUrl,
  listConnections,
  listAccounts,
  type BrokerConnection,
  type BrokerAccount,
} from "@/lib/snaptrade-client";

export default function BrokerConnections() {
  const { user } = useAuth();
  const { canUseBrokerSync, triggerUpgrade } = usePlan();
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showAccountSelection, setShowAccountSelection] = useState(false);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [connResult, acctResult] = await Promise.all([
        listConnections(),
        listAccounts(),
      ]);
      setConnections(connResult.connections);
      setAccounts(acctResult.accounts);
    } catch (err: any) {
      console.error("[BrokerConnections] Error fetching data:", err);
      // Don't toast on initial load if no integration exists yet
      if (!err.message?.includes("credentials not configured")) {
        toast.error("Failed to load broker connections");
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check if returning from SnapTrade connection flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("broker_connected") === "true") {
      toast.success("Broker connected successfully!");
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      // Refresh and show account selection
      fetchData().then(() => setShowAccountSelection(true));
    }
  }, [fetchData]);

  const handleConnectBroker = async () => {
    setConnecting(true);
    try {
      // Step 1: Register SnapTrade user if needed
      await registerSnapTradeUser();

      // Step 2: Generate connection portal URL
      const redirectUri = `${window.location.origin}/broker-connections?broker_connected=true`;
      const { redirect_url } = await generateConnectUrl(redirectUri);

      if (!redirect_url) {
        toast.error("Could not generate broker connection link. Please try again.");
        return;
      }

      // Step 3: Redirect to SnapTrade hosted flow
      window.location.href = redirect_url;
    } catch (err: any) {
      console.error("[BrokerConnections] Connect error:", err);
      if (err.message?.includes("credentials not configured")) {
        toast.error("Broker integration is not configured yet. Please add your SnapTrade API credentials.");
      } else {
        toast.error(err.message || "Failed to start broker connection. Please try again.");
      }
    } finally {
      setConnecting(false);
    }
  };

  const connectedCount = connections.filter((c) => c.connection_status === "connected").length;
  const selectedAccounts = accounts.filter((a) => a.is_selected_for_import).length;
  const lastSync = connections.reduce((latest, c) => {
    if (!c.last_synced_at) return latest;
    return !latest || new Date(c.last_synced_at) > new Date(latest) ? c.last_synced_at : latest;
  }, null as string | null);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Broker Connections</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your brokerage securely and auto-import trades into Momentra.
        </p>
      </motion.div>

      {/* Overview Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          { label: "Connected Brokers", value: connectedCount, icon: Link2, color: "text-profit" },
          { label: "Imported Accounts", value: selectedAccounts, icon: Wallet, color: "text-primary" },
          {
            label: "Last Sync",
            value: lastSync ? new Date(lastSync).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never",
            icon: Clock,
            color: "text-muted-foreground",
          },
          {
            label: "Sync Health",
            value: connections.some((c) => c.connection_status === "needs_reconnect") ? "Action Needed" : connectedCount > 0 ? "Healthy" : "No Connections",
            icon: Activity,
            color: connections.some((c) => c.connection_status === "needs_reconnect") ? "text-amber-400" : connectedCount > 0 ? "text-profit" : "text-muted-foreground",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className={`text-lg font-mono font-medium ${stat.color === "text-muted-foreground" ? "text-foreground" : stat.color}`}>
              {typeof stat.value === "number" ? stat.value : stat.value}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Sync Status Banner */}
      <SyncStatusBanner syncingConnectionId={syncingConnectionId} />

      {/* Connect CTA + Connections */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Your Broker Connections</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              className="gap-2 text-xs"
              onClick={handleConnectBroker}
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Connect Broker
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-white/[0.05] flex items-center justify-center mx-auto">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-foreground font-medium">No brokers connected yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Securely connect your brokerage and auto-import your trade history into Momentra. Your broker credentials are handled through a secure connection provider.
              </p>
            </div>
            <Button onClick={handleConnectBroker} disabled={connecting} className="gap-2">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Connect Your First Broker
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <BrokerConnectionCard
                key={conn.id}
                connection={conn}
                accounts={accounts.filter((a) => a.connection_id === conn.id)}
                onRefresh={fetchData}
                onSync={(id) => setSyncingConnectionId(id)}
                onSyncComplete={() => {
                  setSyncingConnectionId(null);
                  fetchData();
                }}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Security Note */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.09 }}
        className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
      >
        <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-xs text-foreground font-medium">Secure Broker Connection</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Momentra uses a secure broker connection flow to sync your account activity. Your broker credentials are handled through the connection provider, not stored directly in Momentra.
          </p>
        </div>
      </motion.div>

      {/* Account Selection Modal */}
      <AccountSelectionModal
        open={showAccountSelection}
        onOpenChange={setShowAccountSelection}
        accounts={accounts}
        onComplete={() => {
          setShowAccountSelection(false);
          fetchData();
        }}
      />
    </div>
  );
}
