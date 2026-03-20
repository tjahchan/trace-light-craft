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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calculatePnl, getAssetClass } from "@/lib/trade-utils";
import { toast } from "@/hooks/use-toast";
import { OptionsTradeForm } from "@/components/options/OptionsTradeForm";

interface TradeImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
  onTradeCreated?: () => void;
}

type TradeType = "standard" | "options";

export function TradeImportModal({ open, onOpenChange, accountId, onTradeCreated }: TradeImportModalProps) {
  const { user } = useAuth();
  const [tradeType, setTradeType] = useState<TradeType>("standard");
  const [tradeStatus, setTradeStatus] = useState<"closed" | "open">("closed");
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("");
  const [qty, setQty] = useState("");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [tags, setTags] = useState("");
  const [alias, setAlias] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const [saving, setSaving] = useState(false);

  const isClosed = tradeStatus === "closed";

  const pnl = useMemo(() => {
    if (!isClosed) return null;
    return calculatePnl(
      parseFloat(entry),
      parseFloat(exit),
      parseFloat(qty),
      side,
      symbol
    );
  }, [symbol, side, qty, entry, exit, isClosed]);

  const buildDateTime = () => {
    if (!selectedDate) return null;
    const d = new Date(selectedDate);
    let h = parseInt(hour) || 12;
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    d.setHours(h, parseInt(minute) || 0, 0, 0);
    return d.toISOString();
  };

  const handleSave = async () => {
    if (!user || !accountId) {
      toast({ title: "No account selected", variant: "destructive" });
      return;
    }
    if (!symbol || !side || !entry || !qty) {
      toast({ title: "Fill in required fields (Symbol, Side, Entry, Qty)", variant: "destructive" });
      return;
    }
    if (isClosed && !exit) {
      toast({ title: "Exit price is required for closed trades", variant: "destructive" });
      return;
    }

    setSaving(true);
    const entryNum = parseFloat(entry);
    const exitNum = isClosed ? parseFloat(exit) : null;
    const qtyNum = parseFloat(qty);
    const computedPnl = isClosed && exitNum ? calculatePnl(entryNum, exitNum, qtyNum, side, symbol) : null;
    const dateTime = buildDateTime();
    const tagArr = tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [];

    const { error } = await supabase.from("trades").insert({
      user_id: user.id,
      account_id: accountId,
      symbol: symbol.toUpperCase(),
      side: side === "long" ? "Long" : "Short",
      quantity: qtyNum,
      entry_price: entryNum,
      exit_price: exitNum,
      tp: parseFloat(tp) || null,
      sl: parseFloat(sl) || null,
      pnl: computedPnl,
      status: tradeStatus,
      open_time: dateTime,
      close_time: isClosed ? dateTime : null,
      tags: tagArr,
      note: notes || "",
      trade_type: "standard",
    } as any);

    setSaving(false);
    if (error) {
      console.error("Trade insert error:", error);
      toast({ title: "Failed to save trade", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: isClosed ? "Trade saved" : "Open position created" });
    // Reset form
    setSymbol(""); setSide(""); setQty(""); setEntry(""); setExit("");
    setTp(""); setSl(""); setTags(""); setAlias(""); setNotes("");
    setSelectedDate(new Date()); setTradeStatus("closed");
    onOpenChange(false);
    onTradeCreated?.();
  };

  const handleOptionsCreated = () => {
    onTradeCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "backdrop-blur-xl bg-black/60 border-white/[0.1]",
        tradeType === "options" ? "max-w-3xl" : "max-w-lg"
      )}>
        <DialogHeader>
          <DialogTitle className="text-foreground">New Trade</DialogTitle>
        </DialogHeader>

        {/* Trade Type Selector */}
        <div className="flex rounded-xl bg-white/[0.05] p-1 mb-2">
          <button
            onClick={() => setTradeType("standard")}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
              tradeType === "standard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Stock / Forex
          </button>
          <button
            onClick={() => setTradeType("options")}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
              tradeType === "options" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Options
          </button>
        </div>

        {tradeType === "options" ? (
          <OptionsTradeForm
            accountId={accountId || ""}
            onTradeCreated={handleOptionsCreated}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <div className="grid gap-4 py-2">
            {/* Open / Closed Toggle */}
            <div className="flex rounded-xl bg-white/[0.05] p-1">
              <button
                onClick={() => setTradeStatus("open")}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
                  !isClosed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Open Position
              </button>
              <button
                onClick={() => setTradeStatus("closed")}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
                  isClosed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Closed Position
              </button>
            </div>

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

            <div className={cn("grid gap-3", isClosed ? "grid-cols-3" : "grid-cols-2")}>
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
              {isClosed && (
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
              )}
            </div>

            {/* Live PnL Preview — only for closed */}
            {isClosed && pnl !== null && (
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
                  {getAssetClass(symbol).toUpperCase()} • {side === "long" ? "Long" : "Short"}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Take Profit</Label>
                <Input type="number" placeholder="TP" value={tp} onChange={(e) => setTp(e.target.value)} className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Stop Loss</Label>
                <Input type="number" placeholder="SL" value={sl} onChange={(e) => setSl(e.target.value)} className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono" />
              </div>
            </div>

            {/* Date & Time Picker */}
            <div>
              <Label className="text-xs text-muted-foreground">{isClosed ? "Date & Time" : "Opened At"}</Label>
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
                <Input placeholder="Scalp, Breakout" value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 bg-white/[0.04] border-white/[0.08]" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Alias</Label>
                <Input placeholder="Morning Dip" value={alias} onChange={(e) => setAlias(e.target.value)} className="mt-1 bg-white/[0.04] border-white/[0.08]" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea placeholder="Trade notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 bg-white/[0.04] border-white/[0.08] resize-none" rows={2} />
            </div>
            <Button className="w-full mt-2" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : isClosed ? "Save Trade" : "Open Trade"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
