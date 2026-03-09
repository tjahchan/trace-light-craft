import { useState, useEffect, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calculatePnl, getContractSize, getContractSizeLabel } from "@/lib/trade-utils";
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
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Save,
  Share2,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ShareTradeCard } from "@/components/ShareTradeCard";

const timeframes = ["1m", "30m", "1h"];

const triggerCelebration = () => {
  console.log("🎉 Confetti triggered — closed trade celebration");
  // First burst from top-left
  confetti({
    particleCount: 60,
    spread: 80,
    origin: { x: 0.2, y: 0 },
    colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#ffffff', '#e0e7ff'],
    gravity: 0.8,
    ticks: 150,
  });
  // Second burst from top-right
  setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 80,
      origin: { x: 0.8, y: 0 },
      colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#ffffff', '#e0e7ff'],
      gravity: 0.8,
      ticks: 150,
    });
  }, 150);
  // Center burst
  setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 120,
      origin: { x: 0.5, y: 0 },
      colors: ['#3b82f6', '#93c5fd', '#ffffff'],
      gravity: 0.7,
      ticks: 200,
    });
  }, 300);
};

export default function TradeDetail() {
  const { tradeId } = useParams<{ tradeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [trade, setTrade] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("Long");
  const [qty, setQty] = useState("");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [brokerFee, setBrokerFee] = useState("");
  const [status, setStatus] = useState("Closed");
  const [tags, setTags] = useState("");
  const [openedAt, setOpenedAt] = useState<Date | undefined>(new Date());
  const [journalNote, setJournalNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [selectedTf, setSelectedTf] = useState("1m");
  const [isDirty, setIsDirty] = useState(false);
  const [journalSaving, setJournalSaving] = useState(false);

  // Edit history
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const lastSavedNoteRef = useRef("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUsername, setShareUsername] = useState("");

  async function fetchTrade() {
    if (!tradeId) {
      setFetchError("No trade ID provided");
      setLoading(false);
      return;
    }

    console.log("Trade ID from URL:", tradeId);
    setLoading(true);
    setFetchError(null);

    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .maybeSingle();

    if (error) {
      console.error("Trade fetch error:", error, "for id:", tradeId);
      setFetchError(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      console.log("Trade not found for id:", tradeId);
      setFetchError(null);
      setTrade(null);
      setLoading(false);
      return;
    }

    setTrade(data);
    setSymbol(data.symbol || "");
    setSide(data.side || "Long");
    setQty(data.quantity?.toString() || "");
    setEntry(data.entry_price?.toString() || "");
    setExit(data.exit_price?.toString() || "");
    setSl(data.sl?.toString() || "");
    setTp(data.tp?.toString() || "");
    setBrokerFee(data.commissions?.toString() || "");
    setStatus(data.status === "closed" ? "Closed" : "Open");
    setTags(data.tags?.join(", ") || "");
    setOpenedAt(data.open_time ? new Date(data.open_time) : new Date());
    setJournalNote(data.note || "");
    lastSavedNoteRef.current = data.note || "";
    setIsDirty(false);
    setLoading(false);
  }

  async function fetchEditHistory() {
    if (!tradeId) return;
    const { data } = await supabase
      .from("trade_edits" as any)
      .select("*")
      .eq("trade_id", tradeId)
      .order("edited_at", { ascending: false })
      .limit(50);
    if (data) setEditHistory(data as any[]);
  }

  useEffect(() => {
    fetchTrade();
    fetchEditHistory();
    // Fetch username for sharing
    if (user) {
      supabase.from("profiles").select("username, display_name").eq("user_id", user.id).single().then(({ data }) => {
        if (data) setShareUsername((data as any).username || data.display_name || "");
      });
    }
  }, [tradeId, user]);

  // Live PnL recalculation
  const livePnl = useMemo(() => {
    const e = parseFloat(entry) || 0;
    const x = parseFloat(exit) || 0;
    const q = parseFloat(qty) || 0;
    const fee = parseFloat(brokerFee) || 0;
    if (!e || !x || !q) return trade?.pnl || 0;
    return calculatePnl(e, x, q, side, symbol, fee);
  }, [entry, exit, qty, side, symbol, brokerFee, trade]);

  const entryNum = parseFloat(entry) || 0;
  const exitNum = parseFloat(exit) || 0;
  const slNum = parseFloat(sl) || 0;
  const tpNum = parseFloat(tp) || 0;
  const qtyNum = parseFloat(qty) || 0;

  const contractSize = getContractSize(symbol);
  const contractSizeLabel = getContractSizeLabel(symbol);
  const qtyFiat = (qtyNum * contractSize * entryNum).toFixed(2);
  const riskReward = slNum && tpNum && entryNum
    ? (Math.abs(tpNum - entryNum) / Math.abs(entryNum - slNum)).toFixed(2)
    : "—";

  // Save journal note only
  const handleSaveJournal = async () => {
    if (!tradeId || !user || !isDirty) return;
    setJournalSaving(true);

    const { error } = await supabase
      .from("trades")
      .update({ note: journalNote })
      .eq("id", tradeId);

    if (!error && trade?.status === "closed") {
      triggerCelebration();
      toast({ title: "Journal entry saved 🎉", description: "Keep reflecting on your trades!" });
      lastSavedNoteRef.current = journalNote;
      setIsDirty(false);
    } else if (!error) {
      toast({ title: "Journal entry saved" });
      lastSavedNoteRef.current = journalNote;
      setIsDirty(false);
    } else {
      console.error("Journal save error:", error);
      toast({ title: "Failed to save journal", variant: "destructive" });
    }
    setJournalSaving(false);
  };

  const handleSave = async () => {
    if (!tradeId || !user) return;
    setSaving(true);

    const newEntry = parseFloat(entry) || 0;
    const newExit = parseFloat(exit) || null;
    const newQty = parseFloat(qty) || 0;
    const newSl = parseFloat(sl) || null;
    const newTp = parseFloat(tp) || null;
    const newFee = parseFloat(brokerFee) || 0;
    const newPnl = newExit ? calculatePnl(newEntry, newExit, newQty, side, symbol, newFee) : 0;
    const newTags = tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [];

    const updatedFields: Record<string, any> = {
      symbol,
      side,
      quantity: newQty,
      entry_price: newEntry,
      exit_price: newExit,
      sl: newSl,
      tp: newTp,
      commissions: newFee,
      pnl: newPnl,
      status: status.toLowerCase(),
      tags: newTags,
      open_time: openedAt?.toISOString() || null,
      note: journalNote,
    };

    // Build changed_fields for audit log
    const changedFields: Record<string, { old: any; new: any }> = {};
    if (trade) {
      const fieldMap: Record<string, string> = {
        symbol: "symbol", side: "side", quantity: "quantity",
        entry_price: "entry_price", exit_price: "exit_price",
        sl: "sl", tp: "tp", commissions: "commissions",
        pnl: "pnl", status: "status", note: "note",
      };
      for (const [dbField, _] of Object.entries(fieldMap)) {
        const oldVal = trade[dbField];
        const newVal = updatedFields[dbField];
        if (String(oldVal ?? "") !== String(newVal ?? "")) {
          changedFields[dbField] = { old: oldVal, new: newVal };
        }
      }
      // Check tags
      const oldTags = (trade.tags || []).join(", ");
      const newTagsStr = newTags.join(", ");
      if (oldTags !== newTagsStr) {
        changedFields["tags"] = { old: trade.tags, new: newTags };
      }
    }

    const { error } = await supabase
      .from("trades")
      .update(updatedFields)
      .eq("id", tradeId);

    if (error) {
      console.error("Save error:", error);
      toast({ title: "Failed to save trade", variant: "destructive" });
      setSaving(false);
      return;
    }

    console.log("Trade updated:", tradeId, updatedFields);

    // Log edit history if anything changed
    if (Object.keys(changedFields).length > 0) {
      await supabase.from("trade_edits" as any).insert({
        trade_id: tradeId,
        user_id: user.id,
        changed_fields: changedFields,
      });
      fetchEditHistory();
    }

    // Update local trade state so subsequent edits diff correctly
    setTrade({ ...trade, ...updatedFields, tags: newTags });

    // Confetti for journal note save on closed trades
    if (isDirty && updatedFields.status === "closed") {
      triggerCelebration();
      toast({ title: "Journal entry saved 🎉", description: "Keep reflecting on your trades!" });
    } else {
      toast({ title: "Trade saved" });
    }
    lastSavedNoteRef.current = journalNote;
    setIsDirty(false);

    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  // Delete trade
  const handleDeleteTrade = async () => {
    if (!tradeId || !user) return;
    setDeleting(true);

    const { error } = await supabase
      .from("trades")
      .delete()
      .eq("id", tradeId);

    if (!error) {
      toast({ title: "Trade deleted" });
      navigate("/");
    } else {
      console.log("Delete error:", error);
      toast({ title: "Failed to delete trade", description: error.message, variant: "destructive" });
    }
    setDeleting(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading trade…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Error loading trade: {fetchError}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={fetchTrade} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
            <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
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

  const tvSymbol = symbol.replace("/", "").toUpperCase();

  return (
    <div className="h-[calc(100vh-4rem)] grid grid-rows-[1fr_auto] gap-0 overflow-hidden">
      {/* Top section: left info + right chart */}
      <div className="grid grid-cols-1 xl:grid-cols-[30%_70%] gap-0 min-h-0 overflow-hidden">
        {/* Left Panel — Order Info */}
        <div className="backdrop-blur-xl bg-black/40 border-r border-white/[0.06] overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Back + Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Pin className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShareOpen(true)}
                className="h-8 w-8 relative text-primary hover:text-primary group"
                title="Share Trade"
              >
                <span className="absolute inset-0 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300" />
                <span className="absolute inset-0 rounded-md animate-pulse opacity-30 bg-primary/20" />
                <Share2 className="h-4 w-4 relative z-10 drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-loss">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-white/[0.08]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this trade?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This cannot be undone. The trade will be permanently removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteTrade}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleting}
                    >
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{symbol}</h1>
            <p className="text-sm text-muted-foreground">Closed Order</p>
            <p className={cn("text-lg font-mono font-semibold mt-1", livePnl >= 0 ? "text-profit" : "text-loss")}>
              Realized PnL: {livePnl >= 0 ? "+" : ""}${Math.abs(livePnl).toFixed(2)}
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
                {contractSizeLabel && (
                  <p className="text-[10px] text-muted-foreground mt-1">Contract size: {contractSizeLabel}</p>
                )}
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

            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : saved ? (
                <><Check className="h-4 w-4" /> Saved ✓</>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>

          {/* Edit History */}
          {editHistory.length > 0 && (
            <div className="border border-white/[0.08] rounded-xl overflow-hidden">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:bg-white/[0.03] transition-colors"
              >
                Edit History ({editHistory.length})
                {historyOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {historyOpen && (
                <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto">
                  {editHistory.map((edit: any) => {
                    const fields = edit.changed_fields || {};
                    const entries = Object.entries(fields);
                    const time = new Date(edit.edited_at).toLocaleString();
                    return (
                      <div key={edit.id} className="text-[11px] text-muted-foreground border-b border-white/[0.05] pb-2 last:border-0">
                        <p className="text-[10px] text-muted-foreground/60 mb-0.5">{time}</p>
                        {entries.map(([field, val]: [string, any]) => (
                          <p key={field}>
                            <span className="text-foreground/80">{field}</span> changed from{" "}
                            <span className="font-mono text-loss">{String(val.old ?? "—")}</span> →{" "}
                            <span className="font-mono text-profit">{String(val.new ?? "—")}</span>
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-[10px] text-muted-foreground">Unsaved changes</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveJournal}
              disabled={!isDirty || journalSaving}
              className="gap-1.5 h-7 text-xs"
            >
              {journalSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save Journal
            </Button>
          </div>
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
            onChange={(e) => {
              setJournalNote(e.target.value);
              setIsDirty(true);
            }}
            placeholder="Write your trade journal entry here..."
            className="min-h-full bg-transparent border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm"
          />
        </div>
      </div>

      {/* Share Trade Card Modal */}
      <ShareTradeCard
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        symbol={symbol}
        pnl={livePnl}
        entryPrice={entryNum}
        exitPrice={exitNum}
        side={side}
        date={openedAt ? format(openedAt, "PPP") : "—"}
        username={shareUsername}
      />
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
