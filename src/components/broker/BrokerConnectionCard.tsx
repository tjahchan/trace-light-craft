import { useState } from "react";
import {
  Link2,
  RefreshCw,
  Unplug,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Wallet,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  disconnectConnection,
  syncAccount,
  type BrokerConnection,
  type BrokerAccount,
} from "@/lib/snaptrade-client";

interface Props {
  connection: BrokerConnection;
  accounts: BrokerAccount[];
  onRefresh: () => void;
  onSync: (connectionId: string) => void;
  onSyncComplete: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  connected: { label: "Connected", color: "text-profit bg-profit/10", icon: CheckCircle2 },
  needs_reconnect: { label: "Needs Reconnect", color: "text-amber-400 bg-amber-400/10", icon: AlertTriangle },
  syncing: { label: "Syncing", color: "text-primary bg-primary/10", icon: Loader2 },
  disconnected: { label: "Disconnected", color: "text-muted-foreground bg-white/[0.05]", icon: Unplug },
  error: { label: "Error", color: "text-loss bg-loss/10", icon: AlertTriangle },
};

export function BrokerConnectionCard({ connection, accounts, onRefresh, onSync, onSyncComplete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const status = statusConfig[connection.connection_status] || statusConfig.connected;
  const StatusIcon = status.icon;

  const handleSync = async () => {
    if (accounts.length === 0) {
      toast.error("No accounts to sync. Please select accounts first.");
      return;
    }
    setSyncing(true);
    onSync(connection.id);
    try {
      let totalImported = 0;
      for (const account of accounts.filter((a) => a.is_selected_for_import)) {
        const result = await syncAccount(account.id, "manual_sync");
        totalImported += result.imported;
      }
      toast.success(`✓ Synced ${totalImported} activities from ${connection.broker_name}`);
      onSyncComplete();
    } catch (err: any) {
      toast.error(err.message || "Sync failed. Please try again.");
      onSyncComplete();
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectConnection(connection.id);
      toast.success(`${connection.broker_name} disconnected`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
      setShowDisconnectConfirm(false);
    }
  };

  return (
    <>
      <div className="border border-white/[0.08] rounded-xl bg-white/[0.02] overflow-hidden">
        {/* Main row */}
        <div className="flex items-center gap-4 p-4">
          <div className="h-10 w-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
            <Link2 className="h-5 w-5 text-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground text-sm">{connection.broker_name || "Unknown Broker"}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                <StatusIcon className={`h-2.5 w-2.5 ${connection.connection_status === "syncing" ? "animate-spin" : ""}`} />
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                {accounts.length} account{accounts.length !== 1 ? "s" : ""}
              </span>
              {connection.last_synced_at && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Synced {new Date(connection.last_synced_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] h-8 bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground gap-1.5"
              onClick={handleSync}
              disabled={syncing || connection.connection_status === "disconnected"}
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Expanded accounts */}
        {expanded && (
          <div className="border-t border-white/[0.06] p-4 space-y-2 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium">Linked Accounts</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] h-7 text-loss hover:text-loss hover:bg-loss/10"
                onClick={() => setShowDisconnectConfirm(true)}
              >
                <Unplug className="h-3 w-3 mr-1" />
                Disconnect
              </Button>
            </div>
            {accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No accounts linked yet.</p>
            ) : (
              accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white/[0.03] border border-white/[0.05]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium">{account.account_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {account.account_type && `${account.account_type} · `}
                      {account.account_number_masked && `${account.account_number_masked} · `}
                      {account.currency}
                    </p>
                  </div>
                  {account.is_selected_for_import ? (
                    <span className="text-[10px] text-profit bg-profit/10 px-2 py-0.5 rounded-full font-medium">Importing</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground bg-white/[0.05] px-2 py-0.5 rounded-full">Not selected</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Disconnect Confirmation */}
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent className="bg-card border-white/[0.1]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Disconnect {connection.broker_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect your broker and stop future trade syncs. Previously imported trades will remain in your journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/[0.05] border-white/[0.08] text-foreground hover:bg-white/[0.08]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
