import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useStreak } from "@/hooks/useStreak";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Plus,
  FileText,
  Bold,
  Italic,
  List,
  Heading,
  Image,
  Download,
  Check,
  Link2,
  X,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  GripVertical,
  Search,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface LinkedTrade {
  id: string;
  symbol: string;
  date: string;
  side: string;
  entry: number;
  exit: number;
  pnl: number;
}

interface Note {
  id: string;
  title: string;
  body: string;
  folder: string;
  date: string;
  tags: string[];
  linkedTrade?: LinkedTrade;
}

interface Folder {
  id: string;
  name: string;
}

const closedTrades: LinkedTrade[] = [
  { id: "1", symbol: "EUR/USD", date: "2026-03-04", side: "Long", entry: 1.0842, exit: 1.0891, pnl: 73.5 },
  { id: "2", symbol: "XAU/USD", date: "2026-03-03", side: "Short", entry: 2045.3, exit: 2058.1, pnl: -64.0 },
  { id: "3", symbol: "GBP/JPY", date: "2026-03-02", side: "Long", entry: 189.42, exit: 190.18, pnl: 152.0 },
];

const today = new Date().toISOString().split("T")[0];

const initialFolders: Folder[] = [
  { id: "f1", name: "Day Trading" },
  { id: "f2", name: "General" },
  { id: "f3", name: "Strategy Notes" },
];

const initialNotes: Note[] = [
  {
    id: "1", title: "London Breakout Review",
    body: "Tested the London breakout strategy on GBP/USD. Entry was clean at the 08:00 UTC candle break. Need to work on position sizing — went too heavy at 2% risk.",
    folder: "Day Trading", date: "2026-03-04", tags: ["Strategy", "GBP/USD"],
    linkedTrade: closedTrades[0],
  },
  {
    id: "2", title: "Weekly Trading Plan",
    body: "Focus on EUR/USD and GBP/JPY this week. Key levels marked on the chart. Avoid trading during FOMC announcement on Wednesday.",
    folder: "General", date: "2026-03-03", tags: ["Planning"],
  },
  {
    id: "3", title: "ICT Order Block Notes",
    body: "Order blocks form when institutional traders place large orders. Look for the last bearish candle before a bullish impulse move.",
    folder: "Strategy Notes", date: "2026-03-01", tags: ["ICT", "Education"],
    linkedTrade: closedTrades[2],
  },
];

export default function Journal() {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [selectedNoteId, setSelectedNoteId] = useState<string>(notes[0].id);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(initialFolders.map((f) => f.name)));
  const [tradeLinkOpen, setTradeLinkOpen] = useState(false);
  const [tradeSearch, setTradeSearch] = useState("");
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const { recordNoteActivity } = useStreak();

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedNoteId), [notes, selectedNoteId]);

  // Group notes by folder
  const unassignedNotes = useMemo(() => notes.filter((n) => !n.folder), [notes]);
  const notesByFolder = useMemo(() => {
    const map: Record<string, Note[]> = {};
    folders.forEach((f) => { map[f.name] = []; });
    notes.forEach((n) => {
      if (n.folder && map[n.folder]) map[n.folder].push(n);
    });
    return map;
  }, [notes, folders]);

  // Create new note
  const createNote = useCallback(() => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: "Untitled Entry",
      body: "",
      folder: "",
      date: today,
      tags: [],
    };
    setNotes((prev) => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);
    recordNoteActivity();
    setTimeout(() => titleRef.current?.select(), 50);
  }, [recordNoteActivity]);

  // Create new folder
  const createFolder = useCallback(() => {
    const name = `Folder ${folders.length + 1}`;
    const newFolder: Folder = { id: crypto.randomUUID(), name };
    setFolders((prev) => [...prev, newFolder]);
    setExpandedFolders((prev) => new Set([...prev, name]));
  }, [folders.length]);

  // Update note field
  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
    recordNoteActivity();
  }, [recordNoteActivity]);

  // Delete note
  const confirmDeleteNote = useCallback(() => {
    if (!deleteNoteId) return;
    setNotes((prev) => prev.filter((n) => n.id !== deleteNoteId));
    if (selectedNoteId === deleteNoteId) {
      setSelectedNoteId(notes.find((n) => n.id !== deleteNoteId)?.id ?? "");
    }
    setDeleteNoteId(null);
  }, [deleteNoteId, selectedNoteId, notes]);

  // Delete folder
  const confirmDeleteFolder = useCallback(() => {
    if (!deleteFolderId) return;
    const folder = folders.find((f) => f.id === deleteFolderId);
    if (folder) {
      setNotes((prev) => prev.map((n) => (n.folder === folder.name ? { ...n, folder: "" } : n)));
      setFolders((prev) => prev.filter((f) => f.id !== deleteFolderId));
    }
    setDeleteFolderId(null);
  }, [deleteFolderId, folders]);

  // Rename folder
  const confirmRenameFolder = useCallback(() => {
    if (!renamingFolderId || !renameValue.trim()) return;
    const oldFolder = folders.find((f) => f.id === renamingFolderId);
    if (oldFolder) {
      const oldName = oldFolder.name;
      setFolders((prev) => prev.map((f) => (f.id === renamingFolderId ? { ...f, name: renameValue.trim() } : f)));
      setNotes((prev) => prev.map((n) => (n.folder === oldName ? { ...n, folder: renameValue.trim() } : n)));
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.delete(oldName);
        next.add(renameValue.trim());
        return next;
      });
    }
    setRenamingFolderId(null);
    setRenameValue("");
  }, [renamingFolderId, renameValue, folders]);

  // Toggle folder
  const toggleFolder = (name: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  // Drag & Drop
  const handleDragStart = (noteId: string) => setDragNoteId(noteId);
  const handleDragEnd = () => { setDragNoteId(null); setDragOverFolder(null); };
  const handleDropOnFolder = (folderName: string) => {
    if (dragNoteId) {
      updateNote(dragNoteId, { folder: folderName });
      setDragNoteId(null);
      setDragOverFolder(null);
    }
  };

  // Link trade
  const linkTrade = (trade: LinkedTrade | undefined) => {
    if (selectedNote) {
      updateNote(selectedNote.id, { linkedTrade: trade });
    }
    setTradeLinkOpen(false);
    setTradeSearch("");
  };

  const filteredTrades = closedTrades.filter(
    (t) =>
      t.symbol.toLowerCase().includes(tradeSearch.toLowerCase()) ||
      t.date.includes(tradeSearch)
  );

  // Note sidebar item renderer
  const renderNoteItem = (note: Note) => (
    <div
      key={note.id}
      draggable
      onDragStart={() => handleDragStart(note.id)}
      onDragEnd={handleDragEnd}
      className={cn(
        "group flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors cursor-pointer",
        selectedNoteId === note.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
      )}
      onClick={() => setSelectedNoteId(note.id)}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 cursor-grab" />
      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        {renamingNoteId === note.id ? (
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => {
              if (renameValue.trim()) updateNote(note.id, { title: renameValue.trim() });
              setRenamingNoteId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (renameValue.trim()) updateNote(note.id, { title: renameValue.trim() });
                setRenamingNoteId(null);
              }
            }}
            className="h-5 text-xs bg-transparent border-0 p-0 focus-visible:ring-0 text-foreground"
          />
        ) : (
          <span className="text-xs text-foreground truncate block">{note.title}</span>
        )}
        <span className="text-[10px] text-muted-foreground">{note.date}</span>
      </div>
      {note.linkedTrade && <Link2 className="h-2.5 w-2.5 text-primary shrink-0" />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all">
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card border-white/[0.08]">
          <DropdownMenuItem className="text-foreground text-xs" onClick={(e) => {
            e.stopPropagation();
            setRenamingNoteId(note.id);
            setRenameValue(note.title);
          }}>
            <Pencil className="h-3 w-3 mr-2" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive text-xs" onClick={(e) => {
            e.stopPropagation();
            setDeleteNoteId(note.id);
          }}>
            <X className="h-3 w-3 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-5rem)]">
      {/* Left Panel — Folders & Notes */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-64 shrink-0 backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-3 flex flex-col"
      >
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground"
            onClick={createNote}
          >
            <Plus className="h-3 w-3 mr-1" /> Entry
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground"
            onClick={createFolder}
          >
            <FolderOpen className="h-3 w-3 mr-1" /> Folder
          </Button>
        </div>

        <div className="flex-1 overflow-auto space-y-0.5">
          {/* Unassigned Notes */}
          {unassignedNotes.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-2 mb-1">Unassigned</p>
              {unassignedNotes.map(renderNoteItem)}
            </div>
          )}

          {/* Folders */}
          {folders.map((folder) => {
            const folderNotes = notesByFolder[folder.name] || [];
            const isExpanded = expandedFolders.has(folder.name);
            const isDragOver = dragOverFolder === folder.name;

            return (
              <div key={folder.id}>
                <div
                  className={cn(
                    "group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                    isDragOver
                      ? "bg-primary/20 border border-primary/40"
                      : "hover:bg-white/[0.04]"
                  )}
                  onClick={() => toggleFolder(folder.name)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverFolder(folder.name); }}
                  onDragLeave={() => setDragOverFolder(null)}
                  onDrop={(e) => { e.preventDefault(); handleDropOnFolder(folder.name); }}
                >
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                      isExpanded && "rotate-90"
                    )}
                  />
                  <FolderOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                  {renamingFolderId === folder.id ? (
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={confirmRenameFolder}
                      onKeyDown={(e) => { if (e.key === "Enter") confirmRenameFolder(); }}
                      className="h-5 text-xs bg-transparent border-0 p-0 focus-visible:ring-0 text-foreground flex-1"
                    />
                  ) : (
                    <span className="text-xs text-foreground truncate flex-1">{folder.name}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground shrink-0">{folderNotes.length}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all">
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-white/[0.08]">
                      <DropdownMenuItem className="text-foreground text-xs" onClick={(e) => {
                        e.stopPropagation();
                        setRenamingFolderId(folder.id);
                        setRenameValue(folder.name);
                      }}>
                        <Pencil className="h-3 w-3 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive text-xs" onClick={(e) => {
                        e.stopPropagation();
                        setDeleteFolderId(folder.id);
                      }}>
                        <X className="h-3 w-3 mr-2" /> Delete Folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {isExpanded && folderNotes.length > 0 && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {folderNotes.map(renderNoteItem)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Right Panel — Editor */}
      {selectedNote ? (
        <motion.div
          key={selectedNote.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6 flex flex-col min-w-0"
        >
          {/* Trade Reference Bar */}
          {selectedNote.linkedTrade ? (
            <button
              onClick={() => setTradeLinkOpen(true)}
              className="mb-4 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3 text-xs w-full text-left hover:bg-white/[0.06] transition-colors group"
            >
              <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-muted-foreground">References:</span>
              <span className="font-mono font-medium text-foreground">{selectedNote.linkedTrade.symbol}</span>
              <span className={selectedNote.linkedTrade.side === "Long" ? "badge-long" : "badge-short"}>
                {selectedNote.linkedTrade.side}
              </span>
              <span className="text-muted-foreground">— {selectedNote.linkedTrade.date}</span>
              <span className={cn("font-mono font-medium", selectedNote.linkedTrade.pnl >= 0 ? "text-profit" : "text-loss")}>
                {selectedNote.linkedTrade.pnl >= 0 ? "+" : ""}${Math.abs(selectedNote.linkedTrade.pnl).toFixed(2)}
              </span>
              <Pencil className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ) : (
            <button
              onClick={() => setTradeLinkOpen(true)}
              className="mb-4 p-3 rounded-xl border border-dashed border-white/[0.1] flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:border-white/[0.2] transition-colors w-full"
            >
              <Link2 className="h-3.5 w-3.5" />
              🔗 Link a trade
            </button>
          )}

          {/* Title */}
          <Input
            ref={titleRef}
            value={selectedNote.title}
            onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
            className="text-xl font-semibold bg-transparent border-0 px-0 focus-visible:ring-0 text-foreground mb-1"
          />

          {/* Meta row: date + folder selector */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-muted-foreground">{selectedNote.date}</span>
            <Select
              value={selectedNote.folder || "__none__"}
              onValueChange={(v) => updateNote(selectedNote.id, { folder: v === "__none__" ? "" : v })}
            >
              <SelectTrigger className="h-6 w-auto min-w-[120px] text-xs bg-white/[0.04] border-white/[0.06] text-muted-foreground gap-1 px-2">
                <FolderOpen className="h-3 w-3 shrink-0" />
                <SelectValue placeholder="No folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No folder</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 mb-3 pb-3 border-b border-white/[0.06]">
            {[Bold, Italic, List, Heading, Image].map((Icon, i) => (
              <Button key={i} variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Check className="h-3 w-3 text-profit" /> Saved
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <Textarea
            value={selectedNote.body}
            onChange={(e) => updateNote(selectedNote.id, { body: e.target.value })}
            className="flex-1 bg-transparent border-0 px-0 resize-none focus-visible:ring-0 text-foreground/90 leading-relaxed text-sm"
          />

          {/* Tags */}
          <div className="flex gap-1.5 mt-3 pt-3 border-t border-white/[0.06]">
            {selectedNote.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-primary/15 text-primary">{tag}</span>
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="flex-1 backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Select an entry or create a new one</p>
        </div>
      )}

      {/* Trade Link Dialog */}
      <Dialog open={tradeLinkOpen} onOpenChange={setTradeLinkOpen}>
        <DialogContent className="bg-card border-white/[0.1] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Link to Trade</DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by symbol or date..."
              value={tradeSearch}
              onChange={(e) => setTradeSearch(e.target.value)}
              className="pl-9 bg-white/[0.05] border-white/[0.08] text-foreground"
            />
          </div>
          <div className="space-y-1 max-h-64 overflow-auto">
            <button
              onClick={() => linkTrade(undefined)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs hover:bg-white/[0.05] transition-colors text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" /> None — remove link
            </button>
            {filteredTrades.map((trade) => (
              <button
                key={trade.id}
                onClick={() => linkTrade(trade)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs hover:bg-white/[0.05] transition-colors",
                  selectedNote?.linkedTrade?.id === trade.id && "bg-white/[0.06]"
                )}
              >
                <span className="font-mono font-medium text-foreground">{trade.symbol}</span>
                <span className={trade.side === "Long" ? "badge-long" : "badge-short"}>{trade.side}</span>
                <span className="text-muted-foreground">{trade.date}</span>
                <span className={cn("font-mono ml-auto", trade.pnl >= 0 ? "text-profit" : "text-loss")}>
                  {trade.pnl >= 0 ? "+" : ""}${Math.abs(trade.pnl).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Note Confirmation */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent className="bg-card border-white/[0.1]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/[0.05] border-white/[0.08] text-foreground hover:bg-white/[0.08]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeleteNote}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Folder Confirmation */}
      <AlertDialog open={!!deleteFolderId} onOpenChange={() => setDeleteFolderId(null)}>
        <AlertDialogContent className="bg-card border-white/[0.1]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the folder and move its notes to "Unassigned."
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/[0.05] border-white/[0.08] text-foreground hover:bg-white/[0.08]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeleteFolder}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
