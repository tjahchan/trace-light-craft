import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStreak } from "@/hooks/useStreak";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Search,
  FileText,
  Bold,
  Italic,
  List,
  Heading,
  Download,
  Check,
  Save,
  Loader2,
  ListOrdered,
  Highlighter,
  MessageSquareQuote,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChartScreenshots } from "@/components/journal/ChartScreenshots";
import { StructuredReflection } from "@/components/journal/StructuredReflection";
import { TradeInsightsPanel } from "@/components/journal/TradeInsightsPanel";
import { useIsMobile } from "@/hooks/use-mobile";

interface Trade {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  pnl: number | null;
  quantity: number;
  sl: number | null;
  tp: number | null;
  status: string;
  tags: string[];
  note: string | null;
  open_time: string | null;
  close_time: string | null;
  account_id: string;
}

interface JournalMeta {
  id?: string;
  emotion_before: string | null;
  emotion_after: string | null;
  confidence: number;
  execution: number;
  discipline: number;
  strategy: string;
  setup: string;
  session: string;
  mistakes: string[];
  what_went_well: string;
  what_went_wrong: string;
  lessons_learned: string;
  improvements: string;
}

interface Screenshot {
  id: string;
  storage_path: string;
  label: string;
  url: string;
}

const defaultMeta: JournalMeta = {
  emotion_before: null,
  emotion_after: null,
  confidence: 5,
  execution: 5,
  discipline: 5,
  strategy: "",
  setup: "",
  session: "",
  mistakes: [],
  what_went_well: "",
  what_went_wrong: "",
  lessons_learned: "",
  improvements: "",
};

export default function Journal() {
  const { user } = useAuth();
  const { recordNoteActivity } = useStreak();
  const isMobile = useIsMobile();

  // Trade list state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSymbol, setFilterSymbol] = useState("all");
  const [filterStrategy, setFilterStrategy] = useState("all");

  // Selected trade state
  const [journalNote, setJournalNote] = useState("");
  const [meta, setMeta] = useState<JournalMeta>(defaultMeta);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [accountBalance, setAccountBalance] = useState(10000);
  const [mobilePanel, setMobilePanel] = useState<"list" | "editor" | "insights">("list");

  const lastSavedNote = useRef("");
  const lastSavedMeta = useRef<string>("");

  // Fetch trades
  useEffect(() => {
    if (!user) return;
    async function fetchTrades() {
      setLoading(true);
      const { data } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "closed")
        .order("close_time", { ascending: false });

      if (data) {
        setTrades(data);
        if (data.length > 0 && !selectedTradeId) {
          setSelectedTradeId(data[0].id);
        }
      }
      setLoading(false);
    }

    async function fetchBalance() {
      const { data } = await supabase
        .from("accounts")
        .select("balance")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      if (data) setAccountBalance(data.balance);
    }

    fetchTrades();
    fetchBalance();
  }, [user]);

  // Fetch metadata & screenshots for selected trade
  useEffect(() => {
    if (!selectedTradeId || !user) return;

    async function loadTradeData() {
      // Load note from trade
      const trade = trades.find((t) => t.id === selectedTradeId);
      if (trade) {
        setJournalNote(trade.note || "");
        lastSavedNote.current = trade.note || "";
      }

      // Load metadata
      const { data: metaData } = await supabase
        .from("trade_journal_metadata" as any)
        .select("*")
        .eq("trade_id", selectedTradeId)
        .maybeSingle();

      if (metaData) {
        const m = metaData as any;
        const loaded: JournalMeta = {
          id: m.id,
          emotion_before: m.emotion_before,
          emotion_after: m.emotion_after,
          confidence: m.confidence ?? 5,
          execution: m.execution ?? 5,
          discipline: m.discipline ?? 5,
          strategy: m.strategy ?? "",
          setup: m.setup ?? "",
          session: m.session ?? "",
          mistakes: m.mistakes ?? [],
          what_went_well: m.what_went_well ?? "",
          what_went_wrong: m.what_went_wrong ?? "",
          lessons_learned: m.lessons_learned ?? "",
          improvements: m.improvements ?? "",
        };
        setMeta(loaded);
        lastSavedMeta.current = JSON.stringify(loaded);
      } else {
        setMeta({ ...defaultMeta });
        lastSavedMeta.current = JSON.stringify(defaultMeta);
      }

      // Load screenshots
      const { data: ssData } = await supabase
        .from("trade_screenshots" as any)
        .select("*")
        .eq("trade_id", selectedTradeId)
        .order("sort_order", { ascending: true });

      if (ssData) {
        const withUrls = (ssData as any[]).map((s) => ({
          id: s.id,
          storage_path: s.storage_path,
          label: s.label || "",
          url: supabase.storage.from("chart-screenshots").getPublicUrl(s.storage_path).data.publicUrl,
        }));
        setScreenshots(withUrls);
      } else {
        setScreenshots([]);
      }

      setIsDirty(false);
    }

    loadTradeData();
  }, [selectedTradeId, user]);

  // Track dirty state
  useEffect(() => {
    const noteChanged = journalNote !== lastSavedNote.current;
    const metaChanged = JSON.stringify(meta) !== lastSavedMeta.current;
    setIsDirty(noteChanged || metaChanged);
  }, [journalNote, meta]);

  const selectedTrade = useMemo(() => trades.find((t) => t.id === selectedTradeId), [trades, selectedTradeId]);

  // Unique symbols for filter
  const uniqueSymbols = useMemo(() => [...new Set(trades.map((t) => t.symbol))], [trades]);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.note || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSymbol = filterSymbol === "all" || t.symbol === filterSymbol;
      return matchesSearch && matchesSymbol;
    });
  }, [trades, searchQuery, filterSymbol]);

  // Save journal
  const handleSave = useCallback(async () => {
    if (!selectedTradeId || !user || !isDirty) return;
    setSaving(true);

    // Save note to trades table
    await supabase
      .from("trades")
      .update({ note: journalNote })
      .eq("id", selectedTradeId);

    // Upsert metadata
    const metaPayload = {
      trade_id: selectedTradeId,
      user_id: user.id,
      emotion_before: meta.emotion_before,
      emotion_after: meta.emotion_after,
      confidence: meta.confidence,
      execution: meta.execution,
      discipline: meta.discipline,
      strategy: meta.strategy,
      setup: meta.setup,
      session: meta.session,
      mistakes: meta.mistakes,
      what_went_well: meta.what_went_well,
      what_went_wrong: meta.what_went_wrong,
      lessons_learned: meta.lessons_learned,
      improvements: meta.improvements,
    };

    if (meta.id) {
      await supabase
        .from("trade_journal_metadata" as any)
        .update(metaPayload)
        .eq("id", meta.id);
    } else {
      const { data } = await supabase
        .from("trade_journal_metadata" as any)
        .insert(metaPayload)
        .select("id")
        .single();
      if (data) setMeta((prev) => ({ ...prev, id: (data as any).id }));
    }

    // Update local trade note
    setTrades((prev) =>
      prev.map((t) => (t.id === selectedTradeId ? { ...t, note: journalNote } : t))
    );

    lastSavedNote.current = journalNote;
    lastSavedMeta.current = JSON.stringify(meta);
    setIsDirty(false);
    setSaving(false);

    recordNoteActivity();
    toast({ title: "Journal saved ✓", description: "Your reflection has been saved." });
  }, [selectedTradeId, user, isDirty, journalNote, meta, recordNoteActivity]);

  const handleMetaChange = useCallback((updates: Partial<JournalMeta>) => {
    setMeta((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleReflectionChange = useCallback((field: string, value: string) => {
    setMeta((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Loading
  if (loading) {
    return (
      <div className="h-[calc(100vh-5rem)] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state
  if (trades.length === 0) {
    return (
      <div className="h-[calc(100vh-5rem)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No closed trades to journal yet.</p>
          <p className="text-xs text-muted-foreground/60">Close a trade on the Dashboard to start journaling.</p>
        </div>
      </div>
    );
  }

  // Mobile tab bar
  const MobileTabBar = () => (
    <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06] mb-3 md:hidden">
      {(["list", "editor", "insights"] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => setMobilePanel(tab)}
          className={cn(
            "flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
            mobilePanel === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          )}
        >
          {tab === "list" ? "Trades" : tab === "editor" ? "Journal" : "Insights"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      <MobileTabBar />

      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        {/* LEFT PANEL — Trade Entry List */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "w-72 shrink-0 backdrop-blur-xl bg-black/40 border border-white/[0.08] rounded-2xl flex flex-col overflow-hidden",
            isMobile && mobilePanel !== "list" && "hidden"
          )}
        >
          <div className="p-3 space-y-2 border-b border-white/[0.06]">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search trades..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-white/[0.04] border-white/[0.06]"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-1.5">
              <Select value={filterSymbol} onValueChange={setFilterSymbol}>
                <SelectTrigger className="h-7 text-[10px] bg-white/[0.04] border-white/[0.06] flex-1">
                  <SelectValue placeholder="Symbol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Symbols</SelectItem>
                  {uniqueSymbols.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {filteredTrades.map((trade) => {
                const isSelected = trade.id === selectedTradeId;
                const pnl = trade.pnl ?? 0;
                const date = trade.close_time
                  ? format(new Date(trade.close_time), "MMM d, yyyy")
                  : trade.open_time
                    ? format(new Date(trade.open_time), "MMM d, yyyy")
                    : "—";

                return (
                  <button
                    key={trade.id}
                    onClick={() => {
                      setSelectedTradeId(trade.id);
                      if (isMobile) setMobilePanel("editor");
                    }}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all",
                      isSelected
                        ? "bg-white/[0.08] border border-white/[0.12]"
                        : "hover:bg-white/[0.04] border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 h-2 w-2 rounded-full shrink-0",
                      pnl >= 0 ? "bg-profit" : "bg-loss"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground truncate">{trade.symbol}</span>
                        <span className={cn("text-xs font-mono font-medium shrink-0", pnl >= 0 ? "text-profit" : "text-loss")}>
                          {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn("text-[9px] font-medium", trade.side === "Long" ? "text-profit/70" : "text-loss/70")}>{trade.side}</span>
                        <span className="text-[9px] text-muted-foreground">•</span>
                        <span className="text-[9px] text-muted-foreground">{date}</span>
                      </div>
                      {trade.note && (
                        <p className="text-[9px] text-muted-foreground/60 truncate mt-0.5">{trade.note}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </motion.div>

        {/* CENTER PANEL — Journal Editor */}
        {selectedTrade ? (
          <motion.div
            key={selectedTradeId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex-1 backdrop-blur-xl bg-black/40 border border-white/[0.08] rounded-2xl flex flex-col min-w-0 overflow-hidden",
              isMobile && mobilePanel !== "editor" && "hidden"
            )}
          >
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-4">
                {/* Trade Reference Header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium bg-white/[0.06] border border-white/[0.08] text-foreground">
                    {selectedTrade.symbol}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium", selectedTrade.side === "Long" ? "badge-long" : "badge-short")}>
                    {selectedTrade.side}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedTrade.close_time ? format(new Date(selectedTrade.close_time), "MMMM d, yyyy") : "—"}
                  </span>
                  <span className={cn("text-xs font-mono font-medium", (selectedTrade.pnl ?? 0) >= 0 ? "text-profit" : "text-loss")}>
                    {(selectedTrade.pnl ?? 0) >= 0 ? "+" : ""}${Math.abs(selectedTrade.pnl ?? 0).toFixed(2)}
                  </span>
                  {meta.session && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] bg-primary/10 text-primary border border-primary/20">
                      {meta.session}
                    </span>
                  )}
                </div>

                {/* Chart Screenshots */}
                <ChartScreenshots
                  screenshots={screenshots}
                  tradeId={selectedTradeId!}
                  userId={user!.id}
                  onUploaded={() => {
                    // Reload screenshots
                    supabase
                      .from("trade_screenshots" as any)
                      .select("*")
                      .eq("trade_id", selectedTradeId)
                      .order("sort_order", { ascending: true })
                      .then(({ data }) => {
                        if (data) {
                          setScreenshots(
                            (data as any[]).map((s) => ({
                              id: s.id,
                              storage_path: s.storage_path,
                              label: s.label || "",
                              url: supabase.storage.from("chart-screenshots").getPublicUrl(s.storage_path).data.publicUrl,
                            }))
                          );
                        }
                      });
                  }}
                  onDeleted={(id) => setScreenshots((prev) => prev.filter((s) => s.id !== id))}
                />

                {/* Editor toolbar */}
                <div className="flex items-center gap-1 pb-3 border-b border-white/[0.06]">
                  {[Bold, Italic, List, ListOrdered, Heading, Highlighter, MessageSquareQuote].map((Icon, i) => (
                    <Button key={i} variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </Button>
                  ))}
                  <div className="ml-auto flex items-center gap-2">
                    {!isDirty && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Check className="h-3 w-3 text-profit" /> Saved
                      </span>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={!isDirty || saving}
                      className="h-7 text-xs gap-1.5"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Journal textarea */}
                <Textarea
                  value={journalNote}
                  onChange={(e) => setJournalNote(e.target.value)}
                  placeholder="Write your trade analysis, observations, and reflections..."
                  className="min-h-[180px] bg-transparent border-0 px-0 resize-none focus-visible:ring-0 text-foreground/90 leading-relaxed text-sm"
                />

                {/* Structured Reflection */}
                <StructuredReflection
                  whatWentWell={meta.what_went_well}
                  whatWentWrong={meta.what_went_wrong}
                  lessonsLearned={meta.lessons_learned}
                  improvements={meta.improvements}
                  onChange={handleReflectionChange}
                />
              </div>
            </ScrollArea>
          </motion.div>
        ) : (
          <div className={cn(
            "flex-1 backdrop-blur-xl bg-black/40 border border-white/[0.08] rounded-2xl flex items-center justify-center",
            isMobile && mobilePanel !== "editor" && "hidden"
          )}>
            <p className="text-muted-foreground text-sm">Select a trade to start journaling</p>
          </div>
        )}

        {/* RIGHT PANEL — Trade Insights */}
        {selectedTrade && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "w-72 shrink-0 backdrop-blur-xl bg-black/40 border border-white/[0.08] rounded-2xl overflow-hidden",
              isMobile && mobilePanel !== "insights" && "hidden"
            )}
          >
            <TradeInsightsPanel
              trade={selectedTrade}
              meta={meta}
              accountBalance={accountBalance}
              onMetaChange={handleMetaChange}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
