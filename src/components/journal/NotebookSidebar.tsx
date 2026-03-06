import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Search,
  Plus,
  ChevronRight,
  FileText,
  FolderOpen,
  Folder,
  Star,
  MoreHorizontal,
  BookOpen,
  Brain,
  GraduationCap,
  CalendarCheck,
  Pencil,
  Trash2,
  FolderInput,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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

interface Trade {
  id: string;
  symbol: string;
  side: string;
  pnl: number | null;
  close_time: string | null;
  open_time: string | null;
  note: string | null;
  status: string;
}

interface NotebookSidebarProps {
  userId: string;
  selectedEntryId: string | null;
  selectedTradeId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onSelectTrade: (trade: Trade) => void;
  onCreateEntry: (type: string, folderId?: string) => void;
  entries: JournalEntry[];
  folders: JournalFolder[];
  trades: Trade[];
  onFoldersChange: (folders: JournalFolder[]) => void;
  onEntriesChange: (entries: JournalEntry[]) => void;
}

const ENTRY_TYPE_ICONS: Record<string, typeof FileText> = {
  note: FileText,
  trade_journal: BookOpen,
  strategy: Brain,
  review: CalendarCheck,
  learning: GraduationCap,
};

export function NotebookSidebar({
  userId,
  selectedEntryId,
  selectedTradeId,
  onSelectEntry,
  onSelectTrade,
  onCreateEntry,
  entries,
  folders,
  trades,
  onFoldersChange,
  onEntriesChange,
}: NotebookSidebarProps) {
  const [mode, setMode] = useState<"notes" | "trades">("notes");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [tradeSearch, setTradeSearch] = useState("");

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    const { data } = await supabase
      .from("journal_folders" as any)
      .insert({ user_id: userId, name: "New Folder", sort_order: folders.length })
      .select()
      .single();
    if (data) {
      onFoldersChange([...folders, data as any]);
      setRenamingFolderId((data as any).id);
      setRenameValue("New Folder");
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!renameValue.trim()) return;
    await supabase
      .from("journal_folders" as any)
      .update({ name: renameValue.trim() })
      .eq("id", folderId);
    onFoldersChange(folders.map((f) => (f.id === folderId ? { ...f, name: renameValue.trim() } : f)));
    setRenamingFolderId(null);
  };

  const handleDeleteFolder = async (folderId: string) => {
    // Move entries to unassigned
    await supabase
      .from("journal_entries" as any)
      .update({ folder_id: null })
      .eq("folder_id", folderId);
    await supabase.from("journal_folders" as any).delete().eq("id", folderId);
    onFoldersChange(folders.filter((f) => f.id !== folderId));
    onEntriesChange(entries.map((e) => (e.folder_id === folderId ? { ...e, folder_id: null } : e)));
  };

  const handleMoveEntry = async (entryId: string, folderId: string | null) => {
    await supabase
      .from("journal_entries" as any)
      .update({ folder_id: folderId })
      .eq("id", entryId);
    onEntriesChange(entries.map((e) => (e.id === entryId ? { ...e, folder_id: folderId } : e)));
  };

  const handleTogglePin = async (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const newPinned = !entry.is_pinned;
    await supabase
      .from("journal_entries" as any)
      .update({ is_pinned: newPinned })
      .eq("id", entryId);
    onEntriesChange(entries.map((e) => (e.id === entryId ? { ...e, is_pinned: newPinned } : e)));
  };

  const handleDeleteEntry = async (entryId: string) => {
    await supabase.from("journal_entries" as any).delete().eq("id", entryId);
    onEntriesChange(entries.filter((e) => e.id !== entryId));
  };

  const pinnedEntries = entries.filter((e) => e.is_pinned);
  const filteredEntries = entries.filter(
    (e) =>
      !searchQuery ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTrades = trades.filter(
    (t) =>
      t.status === "closed" &&
      (!tradeSearch ||
        t.symbol.toLowerCase().includes(tradeSearch.toLowerCase()) ||
        (t.note || "").toLowerCase().includes(tradeSearch.toLowerCase()))
  );

  const entriesByFolder = (folderId: string | null) =>
    filteredEntries.filter((e) => e.folder_id === folderId && !e.is_pinned);

  const unassignedEntries = entriesByFolder(null);

  const EntryIcon = ({ type }: { type: string }) => {
    const Icon = ENTRY_TYPE_ICONS[type] || FileText;
    return <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  };

  const EntryItem = ({ entry }: { entry: JournalEntry }) => {
    const isSelected = entry.id === selectedEntryId;
    return (
      <div
        onClick={() => onSelectEntry(entry)}
        className={cn(
          "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-left w-full",
          isSelected
            ? "bg-white/[0.08] border border-white/[0.12]"
            : "hover:bg-white/[0.04] border border-transparent"
        )}
      >
        <EntryIcon type={entry.entry_type} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{entry.title}</p>
          <p className="text-[9px] text-muted-foreground">
            {format(new Date(entry.updated_at), "MMM d")}
          </p>
        </div>
        {entry.is_pinned && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/[0.1] transition-opacity"
            >
              <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => handleTogglePin(entry.id)}>
              <Star className="h-3.5 w-3.5 mr-2" />
              {entry.is_pinned ? "Unpin" : "Pin to top"}
            </DropdownMenuItem>
            {folders.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {folders.map((f) => (
                  <DropdownMenuItem key={f.id} onClick={() => handleMoveEntry(entry.id, f.id)}>
                    <FolderInput className="h-3.5 w-3.5 mr-2" />
                    Move to {f.name}
                  </DropdownMenuItem>
                ))}
                {entry.folder_id && (
                  <DropdownMenuItem onClick={() => handleMoveEntry(entry.id, null)}>
                    <FolderInput className="h-3.5 w-3.5 mr-2" />
                    Remove from folder
                  </DropdownMenuItem>
                )}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDeleteEntry(entry.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Mode Toggle */}
      <div className="p-3 border-b border-white/[0.06]">
        <div data-tour="mode-toggle" className="flex gap-1 p-0.5 bg-white/[0.04] rounded-lg border border-white/[0.06]">
          {(["notes", "trades"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                mode === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "notes" ? (
        <>
          {/* Search + New */}
          <div className="p-3 space-y-2 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-white/[0.04] border-white/[0.06]"
              />
            </div>

            <div className="flex gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button data-tour="new-button" variant="ghost" size="sm" className="h-7 text-xs gap-1 flex-1 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08]">
                    <Plus className="h-3 w-3" />
                    New
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => onCreateEntry("trade_journal")}>
                    <BookOpen className="h-3.5 w-3.5 mr-2" />
                    Trade Journal
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCreateEntry("note")}>
                    <FileText className="h-3.5 w-3.5 mr-2" />
                    Note
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCreateEntry("strategy")}>
                    <Brain className="h-3.5 w-3.5 mr-2" />
                    Strategy
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCreateEntry("review")}>
                    <CalendarCheck className="h-3.5 w-3.5 mr-2" />
                    Review
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCreateEntry("learning")}>
                    <GraduationCap className="h-3.5 w-3.5 mr-2" />
                    Learning
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleCreateFolder}>
                    <FolderOpen className="h-3.5 w-3.5 mr-2" />
                    New Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Notes list */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* Pinned entries */}
              {pinnedEntries.length > 0 && (
                <div className="mb-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider px-3 py-1">
                    Pinned
                  </p>
                  {pinnedEntries.map((entry) => (
                    <EntryItem key={entry.id} entry={entry} />
                  ))}
                </div>
              )}

              {/* Folders */}
              {folders.map((folder) => {
                const folderEntries = entriesByFolder(folder.id);
                const isCollapsed = collapsedFolders.has(folder.id);

                return (
                  <div key={folder.id} className="mb-1">
                    <div className="group flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                      <button onClick={() => toggleFolder(folder.id)} className="p-0.5">
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 text-muted-foreground transition-transform",
                            !isCollapsed && "rotate-90"
                          )}
                        />
                      </button>
                      {isCollapsed ? (
                        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <FolderOpen className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      )}

                      {renamingFolderId === folder.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameFolder(folder.id)}
                          onKeyDown={(e) => e.key === "Enter" && handleRenameFolder(folder.id)}
                          className="flex-1 text-xs bg-transparent border-b border-primary/50 outline-none text-foreground px-1"
                        />
                      ) : (
                        <span className="flex-1 text-xs text-foreground/80 truncate">{folder.name}</span>
                      )}

                      <span className="text-[9px] text-muted-foreground/60 mr-1">{folderEntries.length}</span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/[0.1] transition-opacity">
                            <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => onCreateEntry("note", folder.id)}>
                            <Plus className="h-3.5 w-3.5 mr-2" />
                            Add Note
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenamingFolderId(folder.id);
                              setRenameValue(folder.name);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteFolder(folder.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="pl-5 overflow-hidden"
                        >
                          {folderEntries.length === 0 ? (
                            <p className="text-[9px] text-muted-foreground/40 px-3 py-2">Empty</p>
                          ) : (
                            folderEntries.map((entry) => (
                              <EntryItem key={entry.id} entry={entry} />
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Unassigned entries */}
              {unassignedEntries.length > 0 && (
                <div className="mt-2">
                  {folders.length > 0 && (
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider px-3 py-1">
                      Unfiled
                    </p>
                  )}
                  {unassignedEntries.map((entry) => (
                    <EntryItem key={entry.id} entry={entry} />
                  ))}
                </div>
              )}

              {filteredEntries.length === 0 && folders.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/50">No entries yet</p>
                  <p className="text-[9px] text-muted-foreground/30 mt-1">Click "New" to get started</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      ) : (
        /* Trades mode */
        <>
          <div className="p-3 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search trades..."
                value={tradeSearch}
                onChange={(e) => setTradeSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-white/[0.04] border-white/[0.06]"
              />
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
                    onClick={() => onSelectTrade(trade)}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all",
                      isSelected
                        ? "bg-white/[0.08] border border-white/[0.12]"
                        : "hover:bg-white/[0.04] border border-transparent"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 h-2 w-2 rounded-full shrink-0",
                        pnl >= 0 ? "bg-profit" : "bg-loss"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground truncate">
                          {trade.symbol}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-mono font-medium shrink-0",
                            pnl >= 0 ? "text-profit" : "text-loss"
                          )}
                        >
                          {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
                        </span>
                      </div>
                      <span className="text-[9px] text-muted-foreground">{date}</span>
                      {trade.note && (
                        <p className="text-[9px] text-muted-foreground/60 truncate mt-0.5">
                          {trade.note}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
              {filteredTrades.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/50">No closed trades found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
