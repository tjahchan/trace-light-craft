import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Pin,
  Trash2,
  Bold,
  Italic,
  List,
  Heading2,
  ImagePlus,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* Mock trade data — in production pull from Supabase */
const mockTrades: Record<string, any> = {
  "1": { id: "1", symbol: "EUR/USD", side: "Long", qty: 1.5, entry: 1.0842, exit: 1.0891, sl: 1.081, tp: 1.092, pnl: 73.5, status: "Closed", closedAt: "2026-03-04T14:32:00Z", tags: ["Scalp"], brokerFee: 2.5, note: "" },
  "2": { id: "2", symbol: "XAU/USD", side: "Short", qty: 0.5, entry: 2045.3, exit: 2058.1, sl: null, tp: 2030, pnl: -64.0, status: "Closed", closedAt: "2026-03-03T19:15:00Z", tags: ["Swing"], brokerFee: 3.0, note: "" },
  "3": { id: "3", symbol: "GBP/JPY", side: "Long", qty: 2.0, entry: 189.42, exit: 190.18, sl: 188.9, tp: 191.0, pnl: 152.0, status: "Closed", closedAt: "2026-03-02T03:45:00Z", tags: ["Breakout"], brokerFee: 1.8, note: "" },
};

const timeframes = ["1m", "30m", "1h"];

export default function TradeDetail() {
  const { tradeId } = useParams<{ tradeId: string }>();
  const navigate = useNavigate();
  const trade = mockTrades[tradeId || ""];

  const [symbol, setSymbol] = useState(trade?.symbol || "");
  const [side, setSide] = useState(trade?.side || "Long");
  const [qty, setQty] = useState(trade?.qty?.toString() || "");
  const [entry, setEntry] = useState(trade?.entry?.toString() || "");
  const [exit, setExit] = useState(trade?.exit?.toString() || "");
  const [sl, setSl] = useState(trade?.sl?.toString() || "");
  const [tp, setTp] = useState(trade?.tp?.toString() || "");
  const [brokerFee, setBrokerFee] = useState(trade?.brokerFee?.toString() || "");
  const [status, setStatus] = useState(trade?.status || "Closed");
  const [tags, setTags] = useState(trade?.tags?.join(", ") || "");
  const [openedAt, setOpenedAt] = useState<Date | undefined>(trade?.closedAt ? new Date(trade.closedAt) : new Date());
  const [journalNote, setJournalNote] = useState(trade?.note || "");
  const [saved, setSaved] = useState(false);
  const [selectedTf, setSelectedTf] = useState("1m");

  const entryNum = parseFloat(entry) || 0;
  const exitNum = parseFloat(exit) || 0;
  const slNum = parseFloat(sl) || 0;
  const tpNum = parseFloat(tp) || 0;
  const qtyNum = parseFloat(qty) || 0;

  const qtyFiat = (qtyNum * entryNum).toFixed(2);
  const riskReward = slNum && tpNum && entryNum
    ? (Math.abs(tpNum - entryNum) / Math.abs(entryNum - slNum)).toFixed(2)
    : "—";

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tvSymbol = symbol.replace("/", "").toUpperCase();

  if (!trade) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Trade not found</p>
          <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] grid grid-rows-[1fr_auto] gap-0 overflow-hidden">
      {/* Top section: left info + right chart */}
      <div className="grid grid-cols-1 xl:grid-cols-[35%_65%] gap-0 min-h-0 overflow-hidden">
        {/* Left Panel — Order Info */}
        <div className="backdrop-blur-xl bg-black/40 border-r border-white/[0.06] overflow-y-auto p-6 space-y-4">
          {/* Back + Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Pin className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-loss">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{symbol}</h1>
            <p className="text-sm text-muted-foreground">Closed Order #{trade.id}</p>
            <p className={cn("text-lg font-mono font-semibold mt-1", trade.pnl >= 0 ? "text-profit" : "text-loss")}>
              Realized PnL: {trade.pnl >= 0 ? "+" : ""}${Math.abs(trade.pnl).toFixed(2)}
            </p>
          </div>

          {/* Editable Fields */}
          <div className="space-y-3">
            <FieldCard label="Opened At">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-white/[0.04] border-white/[0.08]", !openedAt && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {openedAt ? format(openedAt, "PPP p") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={openedAt} onSelect={setOpenedAt} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </FieldCard>

            <FieldCard label="Tags">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Scalp, Breakout..." className="bg-white/[0.04] border-white/[0.08]" />
            </FieldCard>

            <FieldCard label="Symbol">
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} className="bg-white/[0.04] border-white/[0.08]" />
            </FieldCard>

            <FieldCard label="Side">
              <Select value={side} onValueChange={setSide}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Long">Long</SelectItem>
                  <SelectItem value="Short">Short</SelectItem>
                </SelectContent>
              </Select>
            </FieldCard>

            <div className="grid grid-cols-2 gap-3">
              <FieldCard label="Quantity">
                <Input value={qty} onChange={(e) => setQty(e.target.value)} type="number" className="bg-white/[0.04] border-white/[0.08]" />
              </FieldCard>
              <FieldCard label="Qty in Fiat">
                <Input value={`$${qtyFiat}`} readOnly className="bg-white/[0.02] border-white/[0.06] text-muted-foreground" />
              </FieldCard>
            </div>

            <FieldCard label="Entry Price">
              <Input value={entry} onChange={(e) => setEntry(e.target.value)} type="number" className="bg-white/[0.04] border-white/[0.08]" />
            </FieldCard>

            <div className="grid grid-cols-2 gap-3">
              <FieldCard label="Take Profit">
                <Input value={tp} onChange={(e) => setTp(e.target.value)} type="number" className="bg-white/[0.04] border-white/[0.08]" />
              </FieldCard>
              <FieldCard label="Stop Loss">
                <Input value={sl} onChange={(e) => setSl(e.target.value)} type="number" className="bg-white/[0.04] border-white/[0.08]" />
              </FieldCard>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FieldCard label="Exit Price">
                <Input value={exit} onChange={(e) => setExit(e.target.value)} type="number" className="bg-white/[0.04] border-white/[0.08]" />
              </FieldCard>
              <FieldCard label="Broker Fee">
                <Input value={brokerFee} onChange={(e) => setBrokerFee(e.target.value)} type="number" className="bg-white/[0.04] border-white/[0.08]" />
              </FieldCard>
            </div>

            <FieldCard label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </FieldCard>

            <FieldCard label="Risk / Reward">
              <Input value={riskReward} readOnly className="bg-white/[0.02] border-white/[0.06] text-muted-foreground" />
            </FieldCard>

            <Button onClick={handleSave} className="w-full gap-2">
              {saved ? <><Check className="h-4 w-4" /> Saved</> : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Right Panel — TradingView Chart */}
        <div className="backdrop-blur-xl bg-black/40 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center gap-1 p-3 border-b border-white/[0.06]">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTf(tf)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  selectedTf === tf ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            <iframe
              key={`${tvSymbol}-${selectedTf}`}
              src={`https://s.tradingview.com/widgetembed/?symbol=${tvSymbol}&interval=${selectedTf === "1m" ? "1" : selectedTf === "30m" ? "30" : "60"}&theme=dark&style=1&locale=en&toolbar_bg=000000&enable_publishing=false&hide_top_toolbar=false&hide_side_toolbar=false&allow_symbol_change=true&save_image=false&withdateranges=true&studies=[]&width=100%25&height=100%25`}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media"
            />
          </div>
        </div>
      </div>

      {/* Bottom — Trade Journal Note */}
      <div className="backdrop-blur-xl bg-black/40 border-t border-white/[0.06] h-[25vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-2 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Trade Journal</h3>
          <span className={cn("text-xs transition-opacity", saved ? "text-profit opacity-100" : "opacity-0")}>
            Saved ✓
          </span>
        </div>
        <div className="flex items-center gap-1 px-6 py-1.5 border-b border-white/[0.06]">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <Heading2 className="h-3.5 w-3.5" />
          </Button>
          <div className="h-4 w-px bg-white/[0.1] mx-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <ImagePlus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <Textarea
            value={journalNote}
            onChange={(e) => setJournalNote(e.target.value)}
            placeholder="Write your trade journal entry here..."
            className="min-h-full bg-transparent border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

function FieldCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
