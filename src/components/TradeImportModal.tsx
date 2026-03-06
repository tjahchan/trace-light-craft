import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TradeImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function detectAssetType(symbol: string): "forex" | "crypto" | "stock" {
  const s = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  const forexPairs = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD", "USDCHF", "GBPJPY", "EURJPY", "EURGBP", "XAUUSD", "XAGUSD"];
  if (forexPairs.some(p => s.includes(p))) return "forex";
  const crypto = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "BNB", "AVAX"];
  if (crypto.some(c => s.includes(c))) return "crypto";
  return "stock";
}

function calculatePnL(
  symbol: string,
  side: string,
  qty: number,
  entry: number,
  exit: number
): number | null {
  if (!side || !qty || !entry || !exit) return null;
  const type = detectAssetType(symbol);
  let pnl: number;

  if (type === "forex") {
    pnl = (exit - entry) * qty * 100000;
    if (symbol.toUpperCase().includes("JPY")) {
      pnl = (exit - entry) * qty * 1000;
    }
    if (symbol.toUpperCase().includes("XAU")) {
      pnl = (exit - entry) * qty * 100;
    }
  } else {
    pnl = (exit - entry) * qty;
  }

  if (side === "short") pnl = -pnl;
  return pnl;
}

export function TradeImportModal({ open, onOpenChange }: TradeImportModalProps) {
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("");
  const [qty, setQty] = useState("");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");

  const pnl = useMemo(() => {
    return calculatePnL(
      symbol,
      side,
      parseFloat(qty),
      parseFloat(entry),
      parseFloat(exit)
    );
  }, [symbol, side, qty, entry, exit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-black/60 border-white/[0.1] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Trade</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Symbol</Label>
              <Input
                placeholder="EUR/USD"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="mt-1 bg-white/[0.04] border-white/[0.08]"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Side</Label>
              <Select value={side} onValueChange={setSide}>
                <SelectTrigger className="mt-1 bg-white/[0.04] border-white/[0.08]">
                  <SelectValue placeholder="Long / Short" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Qty</Label>
              <Input
                type="number"
                placeholder="1.0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Entry</Label>
              <Input
                type="number"
                placeholder="1.0842"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Exit</Label>
              <Input
                type="number"
                placeholder="1.0891"
                value={exit}
                onChange={(e) => setExit(e.target.value)}
                className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono"
              />
            </div>
          </div>

          {/* Live PnL Preview */}
          {pnl !== null && (
            <div className={`rounded-xl p-4 text-center font-mono ${
              pnl >= 0
                ? "bg-profit/10 border border-profit/20"
                : "bg-loss/10 border border-loss/20"
            }`}>
              <p className="text-xs text-muted-foreground mb-1">Estimated PnL</p>
              <p className={`text-2xl font-medium ${pnl >= 0 ? "text-profit" : "text-loss"}`}>
                {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {detectAssetType(symbol).toUpperCase()} • {side === "long" ? "Long" : "Short"}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Take Profit</Label>
              <Input type="number" placeholder="TP" className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Stop Loss</Label>
              <Input type="number" placeholder="SL" className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono" />
            </div>
          </div>

          {/* Date & Time Picker */}
          <div>
            <Label className="text-xs text-muted-foreground">Date & Time</Label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07]",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 backdrop-blur-xl bg-black/80 border-white/[0.1]" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={hour}
                  onChange={(e) => setHour(e.target.value.slice(0, 2))}
                  className="w-14 text-center bg-white/[0.04] border-white/[0.08] font-mono px-1"
                />
                <span className="text-muted-foreground">:</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={minute}
                  onChange={(e) => setMinute(e.target.value.slice(0, 2))}
                  className="w-14 text-center bg-white/[0.04] border-white/[0.08] font-mono px-1"
                />
                <button
                  onClick={() => setAmpm(ampm === "AM" ? "PM" : "AM")}
                  className="px-2 py-1.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-foreground hover:bg-white/[0.1] transition-colors"
                >
                  {ampm}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <Input placeholder="Scalp, Breakout" className="mt-1 bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Alias</Label>
              <Input placeholder="Morning Dip" className="mt-1 bg-white/[0.04] border-white/[0.08]" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea placeholder="Trade notes..." className="mt-1 bg-white/[0.04] border-white/[0.08] resize-none" rows={2} />
          </div>
          <Button className="w-full mt-2">Save Trade</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
