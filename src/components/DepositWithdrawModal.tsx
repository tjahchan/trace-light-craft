import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ArrowDownCircle, ArrowUpCircle, ClipboardList, Repeat, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Transaction {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  note: string;
  date: Date;
  is_recurring?: boolean;
}

export interface RecurringRule {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  frequency: string;
  start_date: string;
  next_due_date: string;
  note: string;
  active: boolean;
}

interface DepositWithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  userId: string;
  onTransactionComplete: () => void;
}

type TabType = "deposit" | "withdrawal" | "history";

export function DepositWithdrawModal({
  open,
  onOpenChange,
  accountId,
  userId,
  onTransactionComplete,
}: DepositWithdrawModalProps) {
  const [tab, setTab] = useState<TabType>("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [loaded, setLoaded] = useState(false);

  const type = tab === "history" ? "deposit" : tab;

  // Load transactions and recurring rules when modal opens
  const loadData = async () => {
    if (!accountId || !userId || loaded) return;
    const { data: txns } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", accountId)
      .eq("user_id", userId)
      .order("date", { ascending: false });
    if (txns) {
      setTransactions(txns.map((t) => ({
        id: t.id,
        type: t.type as "deposit" | "withdrawal",
        amount: Number(t.amount),
        note: t.note || "",
        date: new Date(t.date),
        is_recurring: t.is_recurring,
      })));
    }
    const { data: rules } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("account_id", accountId)
      .eq("user_id", userId)
      .eq("active", true);
    if (rules) {
      setRecurringRules(rules.map((r) => ({
        id: r.id,
        type: r.type as "deposit" | "withdrawal",
        amount: Number(r.amount),
        frequency: r.frequency,
        start_date: r.start_date,
        next_due_date: r.next_due_date,
        note: r.note || "",
        active: r.active,
      })));
    }
    setLoaded(true);
  };

  // Load data when modal opens
  if (open && !loaded) {
    loadData();
  }

  // Reset loaded state when modal closes
  const handleOpenChange = (v: boolean) => {
    if (!v) setLoaded(false);
    onOpenChange(v);
  };

  const handleConfirm = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    // Guard: valid account ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(accountId)) {
      toast.error("No account selected. Please select an account first.");
      return;
    }

    console.log("Depositing into account:", accountId, "user:", userId, "type:", type, "amount:", parsedAmount);
    setSubmitting(true);

    try {
      // 1. Insert transaction into Supabase
      const { error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          account_id: accountId,
          type,
          amount: parsedAmount,
          note: note || "",
          date: date.toISOString(),
        });

      if (txError) {
        console.error("[Deposit] Insert error:", txError);
        toast.error(`Transaction failed: ${txError.message}`);
        return;
      }

      // 2. Update account balance in Supabase
      const { data: accData } = await supabase
        .from("accounts")
        .select("balance")
        .eq("id", accountId)
        .single();

      const currentBalance = accData ? Number(accData.balance) : 0;
      const newBalance = type === "deposit"
        ? currentBalance + parsedAmount
        : currentBalance - parsedAmount;

      await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", accountId);

      // 3. Handle recurring rule
      if (isRecurring) {
        await supabase
          .from("recurring_transactions")
          .insert({
            user_id: userId,
            account_id: accountId,
            type,
            amount: parsedAmount,
            frequency,
            start_date: startDate.toISOString().split("T")[0],
            next_due_date: startDate.toISOString().split("T")[0],
            note: note || "",
          });
      }

      // 4. Success
      toast.success(`✓ ${type === "deposit" ? "Deposit" : "Withdrawal"} confirmed`);
      setAmount("");
      setNote("");
      setDate(new Date());
      setIsRecurring(false);
      setLoaded(false); // Force reload on next open

      // 5. Refresh parent balance + chart
      onTransactionComplete();

      // 6. Close modal
      onOpenChange(false);
    } catch (err: any) {
      console.error("[Deposit] Unexpected error:", err);
      toast.error(`Transaction failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    await supabase
      .from("recurring_transactions")
      .update({ active: false })
      .eq("id", id);
    setRecurringRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Recurring rule cancelled");
  };

  const totalDeposited = transactions.filter(t => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
  const totalWithdrawn = transactions.filter(t => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-white/[0.1] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Deposit / Withdraw</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Add or withdraw funds from your account
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex rounded-lg bg-white/[0.05] p-1">
          <button
            onClick={() => setTab("deposit")}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
              tab === "deposit"
                ? "bg-profit/20 text-profit"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowDownCircle className="h-4 w-4" /> Deposit
          </button>
          <button
            onClick={() => setTab("withdrawal")}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
              tab === "withdrawal"
                ? "bg-loss/20 text-loss"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowUpCircle className="h-4 w-4" /> Withdraw
          </button>
          <button
            onClick={() => setTab("history")}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
              tab === "history"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ClipboardList className="h-4 w-4" /> History
          </button>
        </div>

        {tab !== "history" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground text-xs">Amount</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-white/[0.05] border-white/[0.08] text-foreground font-mono"
              />
            </div>

            {/* Recurring toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-foreground text-xs flex items-center gap-2">
                <Repeat className="h-3.5 w-3.5 text-muted-foreground" /> Recurring
              </Label>
              <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>

            {isRecurring && (
              <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                <div className="space-y-1">
                  <Label className="text-foreground text-xs">Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="bg-white/[0.05] border-white/[0.08] text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-foreground text-xs">Starting from</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start bg-white/[0.05] border-white/[0.08] text-foreground font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {format(startDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(d) => d && setStartDate(d)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-foreground text-xs">Note (optional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Monthly funding"
                className="bg-white/[0.05] border-white/[0.08] text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground text-xs">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-white/[0.05] border-white/[0.08] text-foreground font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {format(date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={handleConfirm} className="w-full" disabled={!amount || parseFloat(amount) <= 0 || submitting}>
              {submitting ? "Processing..." : `Confirm ${type === "deposit" ? "Deposit" : "Withdrawal"}`}
            </Button>

            {/* Active Recurring Rules */}
            {recurringRules.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Active Recurring</p>
                <div className="space-y-1">
                  {recurringRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.03] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Repeat className="h-3 w-3 text-primary" />
                        <span className={rule.type === "deposit" ? "text-profit" : "text-loss"}>
                          {rule.type === "deposit" ? "+" : "-"}${Number(rule.amount).toFixed(2)}
                        </span>
                        <span className="text-muted-foreground capitalize">{rule.frequency}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteRecurring(rule.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* History Tab */
          <div>
            <div className="flex gap-4 mb-3 text-xs">
              <span className="text-muted-foreground">
                Total deposited: <span className="text-profit font-mono">${totalDeposited.toFixed(2)}</span>
              </span>
              <span className="text-muted-foreground">
                Total withdrawn: <span className="text-loss font-mono">${totalWithdrawn.toFixed(2)}</span>
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground text-xs py-6">No transactions yet.</p>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.03] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={tx.type === "deposit" ? "text-profit" : "text-loss"}>
                        {tx.type === "deposit" ? "↓" : "↑"}
                      </span>
                      <span className="text-muted-foreground">{format(new Date(tx.date), "MMM d, yyyy")}</span>
                      {tx.is_recurring && <Repeat className="h-2.5 w-2.5 text-primary" />}
                      {tx.note && (
                        <span className="text-muted-foreground/70 truncate max-w-[100px]">{tx.note}</span>
                      )}
                    </div>
                    <span className={cn("font-mono", tx.type === "deposit" ? "text-profit" : "text-loss")}>
                      {tx.type === "deposit" ? "+" : "-"}${tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
