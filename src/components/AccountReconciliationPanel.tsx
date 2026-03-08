/**
 * AccountReconciliationPanel — Debug view showing ledger breakdown for the selected account.
 * Used in Settings or Admin for verifying balance accuracy.
 */
import { useAuth } from "@/contexts/AuthContext";
import { useAccountLedger } from "@/hooks/useAccountLedger";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AccountReconciliationPanel() {
  const { user } = useAuth();
  const selectedAccountId = localStorage.getItem("selectedAccountId") || "";
  const { breakdown, loading, reconcile } = useAccountLedger(user?.id, selectedAccountId || undefined);

  if (!selectedAccountId) {
    return <p className="text-sm text-muted-foreground">No account selected.</p>;
  }

  const rows: [string, number, string?][] = [
    ["Starting Balance", breakdown.initialBalance],
    ["+ Total Deposits", breakdown.totalDeposits, "text-profit"],
    ["− Total Withdrawals", breakdown.totalWithdrawals, "text-loss"],
    ["+ Realized PnL (gross)", breakdown.totalRealizedPnl, breakdown.totalRealizedPnl >= 0 ? "text-profit" : "text-loss"],
    ["− Total Commissions", breakdown.totalCommissions, "text-loss"],
  ];

  const netPnl = breakdown.totalRealizedPnl - breakdown.totalCommissions;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Balance Reconciliation</h3>
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => reconcile()} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Recalculate
        </Button>
      </div>

      <div className="space-y-1">
        {rows.map(([label, value, color]) => (
          <div key={label as string} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{label as string}</span>
            <span className={cn("font-mono", color || "text-foreground")}>
              ${Math.abs(value as number).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        <div className="border-t border-white/[0.08] pt-1 mt-1" />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Net Realized PnL</span>
          <span className={cn("font-mono font-medium", netPnl >= 0 ? "text-profit" : "text-loss")}>
            {netPnl >= 0 ? "+" : "−"}${Math.abs(netPnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="border-t border-white/[0.1] pt-2 mt-2" />
        <div className="flex justify-between text-base font-semibold">
          <span className="text-foreground">Current Balance</span>
          <span className="font-mono text-foreground">
            ${breakdown.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
