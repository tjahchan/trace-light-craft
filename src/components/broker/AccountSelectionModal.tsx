import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Wallet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  selectAccounts,
  syncAccount,
  type BrokerAccount,
} from "@/lib/snaptrade-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BrokerAccount[];
  onComplete: () => void;
}

export function AccountSelectionModal({ open, onOpenChange, accounts, onComplete }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importStats, setImportStats] = useState({ accounts: 0, activities: 0 });

  const toggleAccount = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (selected.size === 0) {
      toast.error("Please select at least one account to import.");
      return;
    }

    setImporting(true);
    try {
      // Mark accounts as selected
      await selectAccounts(Array.from(selected));

      // Trigger initial import for each selected account
      let totalActivities = 0;
      for (const accountId of selected) {
        try {
          const result = await syncAccount(accountId, "initial_import");
          totalActivities += result.imported;
        } catch (err: any) {
          console.error(`[AccountSelection] Sync failed for ${accountId}:`, err);
        }
      }

      setImportStats({ accounts: selected.size, activities: totalActivities });
      setImportComplete(true);
    } catch (err: any) {
      toast.error(err.message || "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSelected(new Set());
    setImportComplete(false);
    setImportStats({ accounts: 0, activities: 0 });
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="backdrop-blur-xl bg-black/60 border-white/[0.1] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {importComplete ? "Import Complete" : "Select Accounts to Import"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {importComplete
              ? "Your broker account is connected and your trade history is syncing into Momentra."
              : "Choose which brokerage accounts to auto-import into Momentra."}
          </DialogDescription>
        </DialogHeader>

        {importComplete ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-profit/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-profit" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-foreground font-medium">Successfully Connected</p>
              <p className="text-sm text-muted-foreground">
                {importStats.accounts} account{importStats.accounts !== 1 ? "s" : ""} synced · {importStats.activities} activities imported
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground" onClick={handleClose}>
                Done
              </Button>
              <Button className="flex-1" onClick={() => { handleClose(); window.location.href = "/journal"; }}>
                Go to Journal
              </Button>
            </div>
          </div>
        ) : (
          <>
            {importing ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-foreground font-medium">Importing historical trades…</p>
                <p className="text-xs text-muted-foreground">This may take a moment. Please don't close this window.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No accounts found. Please check your broker connection.</p>
                ) : (
                  accounts.map((account) => (
                    <label
                      key={account.id}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selected.has(account.id)}
                        onCheckedChange={() => toggleAccount(account.id)}
                      />
                      <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium">{account.account_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {account.broker_name}
                          {account.account_type && ` · ${account.account_type}`}
                          {account.account_number_masked && ` · ${account.account_number_masked}`}
                          {` · ${account.currency}`}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}

            {!importing && accounts.length > 0 && (
              <DialogFooter>
                <Button onClick={handleImport} disabled={selected.size === 0} className="w-full">
                  Import {selected.size} Selected Account{selected.size !== 1 ? "s" : ""}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
