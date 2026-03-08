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
import { Input } from "@/components/ui/input";
import { Loader2, Shield, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  authenticateTradeLocker,
  listTradeLockerAccounts,
  selectTradeLockerAccounts,
  syncTradeLockerAccount,
  type TLAccount,
} from "@/lib/tradelocker-client";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SERVER_OPTIONS = [
  { value: "demo.tradelocker.com", label: "Demo" },
  { value: "live.tradelocker.com", label: "Live" },
  { value: "custom", label: "Custom" },
] as const;

type Step = "credentials" | "connecting" | "accounts" | "importing" | "complete";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function TradeLockerAuthModal({ open, onOpenChange, onComplete }: Props) {
  const [step, setStep] = useState<Step>("credentials");
  const [server, setServer] = useState("live.tradelocker.com");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accounts, setAccounts] = useState<TLAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importStats, setImportStats] = useState({ accounts: 0, activities: 0 });

  const resetState = () => {
    setStep("credentials");
    setServer("live.tradelocker.com");
    setEmail("");
    setPassword("");
    setAccounts([]);
    setSelected(new Set());
    setImportStats({ accounts: 0, activities: 0 });
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleConnect = async () => {
    if (!server.trim() || !email.trim() || !password.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }

    setStep("connecting");
    try {
      await authenticateTradeLocker(server.trim(), email.trim(), password.trim());
      // Immediately clear password from state
      setPassword("");

      // Fetch accounts
      const result = await listTradeLockerAccounts();
      setAccounts(result.accounts);
      setStep("accounts");
    } catch (err: any) {
      toast.error(err.message || "Connection failed. Check your credentials.");
      setStep("credentials");
    }
  };

  const toggleAccount = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (selected.size === 0) {
      toast.error("Please select at least one account.");
      return;
    }

    setStep("importing");
    try {
      await selectTradeLockerAccounts(Array.from(selected));

      let totalActivities = 0;
      for (const accountId of selected) {
        try {
          const result = await syncTradeLockerAccount(accountId, "initial_import");
          totalActivities += result.imported;
        } catch (err: any) {
          console.error(`[TradeLocker] Sync failed for ${accountId}:`, err);
        }
      }

      setImportStats({ accounts: selected.size, activities: totalActivities });
      setStep("complete");
    } catch (err: any) {
      toast.error(err.message || "Import failed.");
      setStep("accounts");
    }
  };

  const handleDone = () => {
    resetState();
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="backdrop-blur-xl bg-black/60 border-white/[0.1] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {step === "complete"
              ? "Import Complete"
              : step === "accounts"
              ? "Select Accounts"
              : "Connect TradeLocker"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {step === "credentials" && "Enter your TradeLocker credentials. Your password is never stored."}
            {step === "connecting" && "Connecting to TradeLocker..."}
            {step === "accounts" && "Choose which accounts to import into Momentra."}
            {step === "importing" && "Importing your trade history..."}
            {step === "complete" && "Your TradeLocker account is connected and trades are syncing."}
          </DialogDescription>
        </DialogHeader>

        {/* Credentials Step */}
        {step === "credentials" && (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Server</label>
              <Input
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="live.tradelocker.com"
                className="bg-white/[0.04] border-white/[0.08] text-foreground"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-white/[0.04] border-white/[0.08] text-foreground"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-white/[0.04] border-white/[0.08] text-foreground"
              />
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">Read-only access only.</span>{" "}
                Momentra cannot execute trades or place orders on your behalf. Your password is used once for authentication and is never stored.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleConnect} className="w-full">
                Connect
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Connecting Step */}
        {step === "connecting" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-foreground font-medium">Connecting to TradeLocker…</p>
            <p className="text-xs text-muted-foreground">Authenticating and fetching accounts.</p>
          </div>
        )}

        {/* Account Selection Step */}
        {step === "accounts" && (
          <>
            <div className="space-y-2 max-h-80 overflow-y-auto mt-2">
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No accounts found.</p>
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium">{account.account_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        TradeLocker
                        {account.account_type && ` · ${account.account_type}`}
                        {account.account_number_masked && ` · ${account.account_number_masked}`}
                        {` · ${account.currency}`}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
            {accounts.length > 0 && (
              <DialogFooter>
                <Button onClick={handleImport} disabled={selected.size === 0} className="w-full">
                  Import {selected.size} Account{selected.size !== 1 ? "s" : ""}
                </Button>
              </DialogFooter>
            )}
          </>
        )}

        {/* Importing Step */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-foreground font-medium">Importing historical trades…</p>
            <p className="text-xs text-muted-foreground">This may take a moment. Please don't close this window.</p>
          </div>
        )}

        {/* Complete Step */}
        {step === "complete" && (
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
              <Button variant="outline" className="flex-1 bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground" onClick={handleDone}>
                Done
              </Button>
              <Button className="flex-1" onClick={() => { handleDone(); window.location.href = "/journal"; }}>
                Go to Journal
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
