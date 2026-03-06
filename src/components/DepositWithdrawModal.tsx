import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Transaction {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  note: string;
  date: Date;
}

interface DepositWithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  onConfirm: (tx: Omit<Transaction, "id">) => void;
}

export function DepositWithdrawModal({
  open,
  onOpenChange,
  transactions,
  onConfirm,
}: DepositWithdrawModalProps) {
  const [type, setType] = useState<"deposit" | "withdrawal">("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState<Date>(new Date());

  const handleConfirm = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;
    onConfirm({ type, amount: parsedAmount, note, date });
    setAmount("");
    setNote("");
    setDate(new Date());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/[0.1] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Deposit / Withdraw</DialogTitle>
        </DialogHeader>

        {/* Toggle */}
        <div className="flex rounded-lg bg-white/[0.05] p-1">
          <button
            onClick={() => setType("deposit")}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
              type === "deposit"
                ? "bg-profit/20 text-profit"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowDownCircle className="h-4 w-4" /> Deposit
          </button>
          <button
            onClick={() => setType("withdrawal")}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
              type === "withdrawal"
                ? "bg-loss/20 text-loss"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowUpCircle className="h-4 w-4" /> Withdraw
          </button>
        </div>

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

          <Button onClick={handleConfirm} className="w-full" disabled={!amount || parseFloat(amount) <= 0}>
            Confirm {type === "deposit" ? "Deposit" : "Withdrawal"}
          </Button>
        </div>

        {/* Transaction History */}
        {transactions.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">History</p>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.03] text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className={tx.type === "deposit" ? "text-profit" : "text-loss"}>
                      {tx.type === "deposit" ? "↓" : "↑"}
                    </span>
                    <span className="text-muted-foreground">{format(new Date(tx.date), "MMM d, yyyy")}</span>
                  </div>
                  <span className={cn("font-mono", tx.type === "deposit" ? "text-profit" : "text-loss")}>
                    {tx.type === "deposit" ? "+" : "-"}${tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
