import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Account {
  id: string;
  name: string;
  balance: number;
  initialBalance: number;
}

interface ManageAccountsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onAccountsChange: (accounts: Account[]) => void;
  userId: string;
  onBalanceRefresh: (accountId: string) => void;
}

export function ManageAccountsModal({
  open,
  onOpenChange,
  accounts,
  onAccountsChange,
  userId,
  onBalanceRefresh,
}: ManageAccountsModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState<number | null>(null);

  const updateAccount = (idx: number, field: keyof Account, value: string | number) => {
    const updated = [...accounts];
    updated[idx] = { ...updated[idx], [field]: value };
    onAccountsChange(updated);
  };

  const addAccount = async () => {
    const { data: newAcc } = await supabase
      .from("accounts")
      .insert({ user_id: userId, name: "", balance: 0 })
      .select()
      .single();
    if (newAcc) {
      const acc: Account = { id: newAcc.id, name: newAcc.name, balance: Number(newAcc.balance) };
      onAccountsChange([...accounts, acc]);
      setActiveTab(accounts.length);
    }
  };

  const deleteAccount = async (idx: number) => {
    if (accounts.length <= 1) return;
    const acc = accounts[idx];
    await supabase.from("accounts").delete().eq("id", acc.id);
    const updated = accounts.filter((_, i) => i !== idx);
    onAccountsChange(updated);
    setActiveTab(Math.min(activeTab, updated.length - 1));
    setDeleteConfirmIdx(null);
    toast.success("Account deleted");
  };

  const handleDone = async () => {
    // Save all account changes to Supabase — write initial_balance, not balance
    for (const acc of accounts) {
      await supabase
        .from("accounts")
        .update({ name: acc.name, initial_balance: acc.balance } as any)
        .eq("id", acc.id);
    }
    // Refresh balance for the current account
    if (accounts.length > 0) {
      onBalanceRefresh(accounts[activeTab]?.id || accounts[0].id);
    }
    toast.success("Accounts saved");
    onOpenChange(false);
  };

  const current = accounts[activeTab];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-white/[0.1] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Manage Accounts</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Add, rename, or set initial balances for your accounts
            </DialogDescription>
          </DialogHeader>

          {/* Account Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {accounts.map((acc, i) => (
              <button
                key={acc.id}
                onClick={() => setActiveTab(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  i === activeTab
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/[0.05] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
                }`}
              >
                {acc.name || `Account ${i + 1}`}
              </button>
            ))}
            <button
              onClick={addAccount}
              className="h-7 w-7 shrink-0 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Active Account Fields */}
          {current && (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-foreground text-xs">Account Name</Label>
                <Input
                  value={current.name}
                  onChange={(e) => updateAccount(activeTab, "name", e.target.value)}
                  placeholder="Enter account name"
                  className="bg-white/[0.05] border-white/[0.08] text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground text-xs">Initial Balance</Label>
                <Input
                  type="number"
                  value={current.initialBalance || ""}
                  onChange={(e) => updateAccount(activeTab, "initialBalance", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="bg-white/[0.05] border-white/[0.08] text-foreground font-mono"
                />
              </div>

              {accounts.length > 1 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setDeleteConfirmIdx(activeTab)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Account
                </Button>
              )}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleDone} className="w-full">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmIdx !== null} onOpenChange={() => setDeleteConfirmIdx(null)}>
        <AlertDialogContent className="bg-card border-white/[0.1]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{accounts[deleteConfirmIdx ?? 0]?.name || "this account"}" and all its associated trades.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/[0.05] border-white/[0.08] text-foreground hover:bg-white/[0.08]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmIdx !== null && deleteAccount(deleteConfirmIdx)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
