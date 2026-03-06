import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStreak } from "@/hooks/useStreak";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  FileText,
  Download,
  Check,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChartScreenshots } from "@/components/journal/ChartScreenshots";
import { StructuredReflection } from "@/components/journal/StructuredReflection";
import { TradeInsightsPanel } from "@/components/journal/TradeInsightsPanel";
import { NotebookSidebar } from "@/components/journal/NotebookSidebar";
import { RichTextEditor } from "@/components/journal/RichTextEditor";
import { NoteScreenshots } from "@/components/journal/NoteScreenshots";
import { AiInsightPanel } from "@/components/journal/AiInsightPanel";
import { JournalOnboardingTour } from "@/components/journal/JournalOnboardingTour";
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

interface JournalFolder {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
}

interface JournalEntry {
  id: string;
  folder_id: string | null;
  trade_id: string | null;
  title: string;
  content: string;
  entry_type: string;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
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

type EditorMode = "entry" | "trade";

export default function Journal() {
  const { user } = useAuth();
  const { recordNoteActivity } = useStreak();
  const isMobile = useIsMobile();

  // Data
  const [trades, setTrades] = useState<Trade[]>([]);
  const [folders, setFolders] = useState<JournalFolder[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [editorMode, setEditorMode] = useState<EditorMode>("entry");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  // Trade journal state
  const [journalNote, setJournalNote] = useState("");
  const [meta, setMeta] = useState<JournalMeta>(defaultMeta);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);

  // Entry state
  const [entryTitle, setEntryTitle] = useState("");
  const [entryContent, setEntryContent] = useState("");
  const [noteScreenshots, setNoteScreenshots] = useState<Screenshot[]>([]);

  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [accountBalance, setAccountBalance] = useState(10000);
  const [mobilePanel, setMobilePanel] = useState<"list" | "editor" | "insights">("list");

  const lastSavedNote = useRef("");
  const lastSavedMeta = useRef("");
  const lastSavedEntryTitle = useRef("");
  const lastSavedEntryContent = useRef("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Fetch all data
  useEffect(() => {
    if (!user) return;
    async function fetchAll() {
      setLoading(true);

      const [tradesRes, foldersRes, entriesRes, balanceRes] = await Promise.all([
        supabase
          .from("trades")
          .select("*")
          .eq("user_id", user!.id)
          .order("close_time", { ascending: false }),
        supabase
          .from("journal_folders" as any)
          .select("*")
          .eq("user_id", user!.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("journal_entries" as any)
          .select("*")
          .eq("user_id", user!.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("accounts")
          .select("balance")
          .eq("user_id", user!.id)
          .limit(1)
          .maybeSingle(),
      ]);

      if (tradesRes.data) setTrades(tradesRes.data);
      if (foldersRes.data) {
        const f = foldersRes.data as any[];
        setFolders(f);
        // Create default folders if none exist
        if (f.length === 0) {
          await createDefaultFolders(user!.id);
        }
      }
      if (entriesRes.data) setEntries(entriesRes.data as any[]);
      if (balanceRes.data) setAccountBalance(balanceRes.data.balance);

      setLoading(false);
    }
    fetchAll();
  }, [user]);

  const createDefaultFolders = async (userId: string) => {
    const defaults = [
      { name: "Trade Journals", sort_order: 0 },
      { name: "Strategies", sort_order: 1 },
      { name: "Psychology", sort_order: 2 },
      { name: "Learning", sort_order: 3 },
      { name: "Weekly Reviews", sort_order: 4 },
    ];
    const { data } = await supabase
      .from("journal_folders" as any)
      .insert(defaults.map((d) => ({ ...d, user_id: userId, is_default: true })))
      .select();
    if (data) setFolders(data as any[]);
  };

  // Load trade data when selecting a trade
  useEffect(() => {
    if (!selectedTradeId || !user || editorMode !== "trade") return;

    async function loadTradeData() {
      const trade = trades.find((t) => t.id === selectedTradeId);
      if (trade) {
        setJournalNote(trade.note || "");
        lastSavedNote.current = trade.note || "";
      }

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

      const { data: ssData } = await supabase
        .from("trade_screenshots" as any)
        .select("*")
        .eq("trade_id", selectedTradeId)
        .order("sort_order", { ascending: true });

      if (ssData) {
        setScreenshots(
          (ssData as any[]).map((s) => ({
            id: s.id,
            storage_path: s.storage_path,
            label: s.label || "",
            url: supabase.storage.from("chart-screenshots").getPublicUrl(s.storage_path).data.publicUrl,
          }))
        );
      } else {
        setScreenshots([]);
      }

      setIsDirty(false);
    }

    loadTradeData();
  }, [selectedTradeId, user, editorMode]);

  const loadNoteScreenshots = useCallback(async (entryId: string) => {
    const { data } = await supabase
      .from("note_screenshots" as any)
      .select("*")
      .eq("entry_id", entryId)
      .order("sort_order", { ascending: true });
    if (data) {
      setNoteScreenshots(
        (data as any[]).map((s) => ({
          id: s.id,
          storage_path: s.storage_path,
          label: s.label || "",
          url: supabase.storage.from("chart-screenshots").getPublicUrl(s.storage_path).data.publicUrl,
        }))
      );
    } else {
      setNoteScreenshots([]);
    }
  }, []);

  // Load entry data when selecting an entry
  useEffect(() => {
    if (!selectedEntryId || editorMode !== "entry") return;
    const entry = entries.find((e) => e.id === selectedEntryId);
    if (entry) {
      setEntryTitle(entry.title);
      setEntryContent(entry.content);
      lastSavedEntryTitle.current = entry.title;
      lastSavedEntryContent.current = entry.content;
      setIsDirty(false);
    }
    loadNoteScreenshots(selectedEntryId);
  }, [selectedEntryId, editorMode, loadNoteScreenshots]);

  // Track dirty state
  useEffect(() => {
    if (editorMode === "trade") {
      const noteChanged = journalNote !== lastSavedNote.current;
      const metaChanged = JSON.stringify(meta) !== lastSavedMeta.current;
      setIsDirty(noteChanged || metaChanged);
    } else {
      const titleChanged = entryTitle !== lastSavedEntryTitle.current;
      const contentChanged = entryContent !== lastSavedEntryContent.current;
      setIsDirty(titleChanged || contentChanged);
    }
  }, [journalNote, meta, entryTitle, entryContent, editorMode]);

  const selectedTrade = useMemo(
    () => trades.find((t) => t.id === selectedTradeId),
    [trades, selectedTradeId]
  );

  // Save trade journal
  const handleSaveTrade = useCallback(async () => {
    if (!selectedTradeId || !user || !isDirty) return;
    setSaving(true);

    await supabase.from("trades").update({ note: journalNote }).eq("id", selectedTradeId);

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
      await supabase.from("trade_journal_metadata" as any).update(metaPayload).eq("id", meta.id);
    } else {
      const { data } = await supabase
        .from("trade_journal_metadata" as any)
        .insert(metaPayload)
        .select("id")
        .single();
      if (data) setMeta((prev) => ({ ...prev, id: (data as any).id }));
    }

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

  // Save entry
  const handleSaveEntry = useCallback(async () => {
    if (!selectedEntryId || !user || !isDirty) return;
    setSaving(true);

    await supabase
      .from("journal_entries" as any)
      .update({ title: entryTitle, content: entryContent, updated_at: new Date().toISOString() })
      .eq("id", selectedEntryId);

    setEntries((prev) =>
      prev.map((e) =>
        e.id === selectedEntryId
          ? { ...e, title: entryTitle, content: entryContent, updated_at: new Date().toISOString() }
          : e
      )
    );

    lastSavedEntryTitle.current = entryTitle;
    lastSavedEntryContent.current = entryContent;
    setIsDirty(false);
    setSaving(false);
    recordNoteActivity();
    toast({ title: "Saved ✓" });
  }, [selectedEntryId, user, isDirty, entryTitle, entryContent, recordNoteActivity]);

  const handleSave = editorMode === "trade" ? handleSaveTrade : handleSaveEntry;

  const handleMetaChange = useCallback((updates: Partial<JournalMeta>) => {
    setMeta((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleReflectionChange = useCallback((field: string, value: string) => {
    setMeta((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Create a new entry
  const handleCreateEntry = useCallback(
    async (type: string, folderId?: string) => {
      if (!user) return;

      const titleMap: Record<string, string> = {
        trade_journal: "Trade Journal",
        note: "Untitled Note",
        strategy: "New Strategy",
        review: `Week ${format(new Date(), "w")} Review`,
        learning: "Learning Notes",
      };

      const { data } = await supabase
        .from("journal_entries" as any)
        .insert({
          user_id: user.id,
          folder_id: folderId || null,
          title: titleMap[type] || "Untitled",
          content: "",
          entry_type: type,
          sort_order: entries.length,
        })
        .select()
        .single();

      if (data) {
        const newEntry = data as any as JournalEntry;
        setEntries((prev) => [newEntry, ...prev]);
        setSelectedEntryId(newEntry.id);
        setSelectedTradeId(null);
        setEditorMode("entry");
        setEntryTitle(newEntry.title);
        setEntryContent("");
        lastSavedEntryTitle.current = newEntry.title;
        lastSavedEntryContent.current = "";
        setIsDirty(false);
        if (isMobile) setMobilePanel("editor");
        // Auto-focus title
        setTimeout(() => titleInputRef.current?.focus(), 100);
      }
    },
    [user, entries, isMobile]
  );

  const handleSelectEntry = useCallback(
    (entry: JournalEntry) => {
      setSelectedEntryId(entry.id);
      setSelectedTradeId(entry.trade_id);
      setEditorMode(entry.trade_id ? "trade" : "entry");
      if (isMobile) setMobilePanel("editor");
    },
    [isMobile]
  );

  const handleSelectTrade = useCallback(
    (trade: Trade) => {
      setSelectedTradeId(trade.id);
      setSelectedEntryId(null);
      setEditorMode("trade");
      if (isMobile) setMobilePanel("editor");
    },
    [isMobile]
  );

  if (loading) {
    return (
      <div className="h-[calc(100vh-5rem)] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
          {tab === "list" ? "Notebook" : tab === "editor" ? "Editor" : "Insights"}
        </button>
      ))}
    </div>
  );

  const showInsightsPanel = editorMode === "trade" && selectedTrade;

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      <MobileTabBar />

      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        {/* LEFT PANEL — Notebook Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "w-72 shrink-0 backdrop-blur-xl bg-black/40 border border-white/[0.08] rounded-2xl flex flex-col overflow-hidden",
            isMobile && mobilePanel !== "list" && "hidden"
          )}
          data-tour="notebook-sidebar"
        >
          <NotebookSidebar
            userId={user!.id}
            selectedEntryId={selectedEntryId}
            selectedTradeId={selectedTradeId}
            onSelectEntry={handleSelectEntry}
            onSelectTrade={handleSelectTrade}
            onCreateEntry={handleCreateEntry}
            entries={entries}
            folders={folders}
            trades={trades}
            onFoldersChange={setFolders}
            onEntriesChange={setEntries}
          />
        </motion.div>

        {/* CENTER PANEL — Editor */}
        {editorMode === "trade" && selectedTrade ? (
          <motion.div
            key={`trade-${selectedTradeId}`}
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
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-medium",
                      selectedTrade.side === "Long" ? "badge-long" : "badge-short"
                    )}
                  >
                    {selectedTrade.side}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedTrade.close_time
                      ? format(new Date(selectedTrade.close_time), "MMMM d, yyyy")
                      : "—"}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-mono font-medium",
                      (selectedTrade.pnl ?? 0) >= 0 ? "text-profit" : "text-loss"
                    )}
                  >
                    {(selectedTrade.pnl ?? 0) >= 0 ? "+" : ""}$
                    {Math.abs(selectedTrade.pnl ?? 0).toFixed(2)}
                  </span>
                  {meta.session && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] bg-primary/10 text-primary border border-primary/20">
                      {meta.session}
                    </span>
                  )}
                </div>

                {/* Save bar */}
                <div className="flex items-center gap-1 pb-3 border-b border-white/[0.06]">
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
                      {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Rich text editor */}
                <RichTextEditor
                  content={journalNote}
                  onChange={setJournalNote}
                  placeholder="Write your trade analysis, observations, and reflections..."
                />

                {/* Structured Reflection */}
                <StructuredReflection
                  whatWentWell={meta.what_went_well}
                  whatWentWrong={meta.what_went_wrong}
                  lessonsLearned={meta.lessons_learned}
                  improvements={meta.improvements}
                  onChange={handleReflectionChange}
                />

                {/* Chart Screenshots — at the bottom */}
                <ChartScreenshots
                  screenshots={screenshots}
                  tradeId={selectedTradeId!}
                  userId={user!.id}
                  onUploaded={() => {
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
                              url: supabase.storage
                                .from("chart-screenshots")
                                .getPublicUrl(s.storage_path).data.publicUrl,
                            }))
                          );
                        }
                      });
                  }}
                  onDeleted={(id) => setScreenshots((prev) => prev.filter((s) => s.id !== id))}
                />
              </div>
            </ScrollArea>
          </motion.div>
        ) : editorMode === "entry" && selectedEntryId ? (
          <motion.div
            key={`entry-${selectedEntryId}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex-1 backdrop-blur-xl bg-black/40 border border-white/[0.08] rounded-2xl flex flex-col min-w-0 overflow-hidden",
              isMobile && mobilePanel !== "editor" && "hidden"
            )}
          >
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-4">
                {/* Entry title */}
                <input
                  ref={titleInputRef}
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  placeholder="Entry title..."
                  className="w-full text-xl font-semibold bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/40"
                />

                {/* Entry type badge */}
                {(() => {
                  const entry = entries.find((e) => e.id === selectedEntryId);
                  if (!entry) return null;
                  const typeLabels: Record<string, string> = {
                    note: "Note",
                    trade_journal: "Trade Journal",
                    strategy: "Strategy",
                    review: "Review",
                    learning: "Learning",
                  };
                  return (
                    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                      {typeLabels[entry.entry_type] || entry.entry_type}
                    </span>
                  );
                })()}

                {/* Save bar */}
                <div className="flex items-center gap-1 pb-3 border-b border-white/[0.06]">
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
                      {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>

                {/* Rich text editor */}
                <RichTextEditor
                  content={entryContent}
                  onChange={setEntryContent}
                  placeholder="Start writing..."
                />

                {/* Note Screenshots */}
                <NoteScreenshots
                  screenshots={noteScreenshots}
                  entryId={selectedEntryId!}
                  userId={user!.id}
                  onUploaded={() => {
                    loadNoteScreenshots(selectedEntryId!);
                  }}
                  onDeleted={(id) => setNoteScreenshots((prev) => prev.filter((s) => s.id !== id))}
                />
              </div>
            </ScrollArea>
          </motion.div>
        ) : (
          <div
            className={cn(
              "flex-1 backdrop-blur-xl bg-black/40 border border-white/[0.08] rounded-2xl flex items-center justify-center",
              isMobile && mobilePanel !== "editor" && "hidden"
            )}
          >
            <div className="text-center space-y-3">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground text-sm">Select an entry or trade to start</p>
              <p className="text-[10px] text-muted-foreground/50">
                Use the notebook panel to create notes, strategies, and trade journals
              </p>
            </div>
          </div>
        )}

        {/* RIGHT PANEL — AI Insight + Trade Insights */}
        {(showInsightsPanel || (editorMode === "entry" && selectedEntryId)) && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "w-72 shrink-0 flex flex-col gap-3 overflow-hidden",
              isMobile && mobilePanel !== "insights" && "hidden"
            )}
          >
            {/* AI Insight Panel */}
            <AiInsightPanel
              content={editorMode === "trade" ? journalNote : entryContent}
              mode={editorMode === "trade" ? "trade" : "note"}
              tradeContext={selectedTrade ? {
                symbol: selectedTrade.symbol,
                side: selectedTrade.side,
                pnl: selectedTrade.pnl,
                entry_price: selectedTrade.entry_price,
                exit_price: selectedTrade.exit_price,
                session: meta.session,
              } : undefined}
            />

            {/* Trade Insights (only for trade mode) */}
            {showInsightsPanel && (
              <div className="flex-1 backdrop-blur-xl bg-black/40 border border-white/[0.08] rounded-2xl overflow-auto">
                <TradeInsightsPanel
                  trade={selectedTrade!}
                  meta={meta}
                  accountBalance={accountBalance}
                  onMetaChange={handleMetaChange}
                />
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
