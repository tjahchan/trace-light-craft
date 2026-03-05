import { useState } from "react";
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

const closedTrades: LinkedTrade[] = [
  { id: "1", symbol: "EUR/USD", date: "2026-03-04", side: "Long", entry: 1.0842, exit: 1.0891, pnl: 73.5 },
  { id: "2", symbol: "XAU/USD", date: "2026-03-03", side: "Short", entry: 2045.3, exit: 2058.1, pnl: -64.0 },
  { id: "3", symbol: "GBP/JPY", date: "2026-03-02", side: "Long", entry: 189.42, exit: 190.18, pnl: 152.0 },
];

const defaultNotes: Note[] = [
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

const folders = ["Day Trading", "General", "Strategy Notes"];

export default function Journal() {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note>(defaultNotes[0]);
  const [showTradeLink, setShowTradeLink] = useState(false);

  const filteredNotes = selectedFolder
    ? defaultNotes.filter((n) => n.folder === selectedFolder)
    : defaultNotes;

  return (
    <div className="flex gap-4 h-[calc(100vh-5rem)]">
      {/* Left Panel — Folders & Notes */}
      <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="w-64 shrink-0 backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-3 flex flex-col">
        <div className="flex gap-2 mb-3">
          <Button size="sm" variant="outline" className="flex-1 text-xs bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground">
            <Plus className="h-3 w-3 mr-1" /> Note
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground">
            <FolderOpen className="h-3 w-3 mr-1" /> Folder
          </Button>
        </div>

        <div className="space-y-0.5 mb-3">
          <button onClick={() => setSelectedFolder(null)} className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${!selectedFolder ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"}`}>
            All Notes
          </button>
          {folders.map((f) => (
            <button key={f} onClick={() => setSelectedFolder(f)} className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${selectedFolder === f ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"}`}>
              <FolderOpen className="h-3 w-3" /> {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto space-y-1">
          {filteredNotes.map((note) => (
            <button key={note.id} onClick={() => setSelectedNote(note)} className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors ${selectedNote.id === note.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
              <div className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground truncate">{note.title}</span>
                {note.linkedTrade && <Link2 className="h-2.5 w-2.5 text-primary shrink-0" />}
              </div>
              <span className="text-[10px] text-muted-foreground ml-4.5">{note.date}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Right Panel — Editor */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex-1 backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6 flex flex-col min-w-0">
        {/* Linked Trade Reference Card */}
        {selectedNote.linkedTrade && (
          <div className="mb-4 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3 text-xs">
            <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground">This note references:</span>
            <span className="font-mono font-medium text-foreground">{selectedNote.linkedTrade.symbol}</span>
            <span className={selectedNote.linkedTrade.side === "Long" ? "badge-long" : "badge-short"}>
              {selectedNote.linkedTrade.side}
            </span>
            <span className="text-muted-foreground">— {selectedNote.linkedTrade.date}</span>
            <span className="text-muted-foreground">—</span>
            <span className={`font-mono font-medium ${selectedNote.linkedTrade.pnl >= 0 ? "text-profit" : "text-loss"}`}>
              {selectedNote.linkedTrade.pnl >= 0 ? "+" : ""}${Math.abs(selectedNote.linkedTrade.pnl).toFixed(2)}
            </span>
          </div>
        )}

        <Input defaultValue={selectedNote.title} className="text-xl font-semibold bg-transparent border-0 px-0 focus-visible:ring-0 text-foreground mb-1" />
        <p className="text-xs text-muted-foreground mb-4">{selectedNote.date}</p>

        {/* Toolbar */}
        <div className="flex items-center gap-1 mb-3 pb-3 border-b border-white/[0.06]">
          {[Bold, Italic, List, Heading, Image].map((Icon, i) => (
            <Button key={i} variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${showTradeLink ? "text-primary" : "text-muted-foreground"} hover:text-foreground`}
            onClick={() => setShowTradeLink(!showTradeLink)}
            title="Link to Trade"
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Check className="h-3 w-3 text-profit" /> Saved
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Trade Link Selector */}
        {showTradeLink && (
          <div className="mb-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Link to a closed trade:</span>
              <button onClick={() => setShowTradeLink(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-1">
              {closedTrades.map((trade) => (
                <button
                  key={trade.id}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs hover:bg-white/[0.05] transition-colors"
                >
                  <span className="font-mono font-medium text-foreground">{trade.symbol}</span>
                  <span className={trade.side === "Long" ? "badge-long" : "badge-short"}>{trade.side}</span>
                  <span className="text-muted-foreground">{trade.date}</span>
                  <span className={`font-mono ml-auto ${trade.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                    {trade.pnl >= 0 ? "+" : ""}${Math.abs(trade.pnl).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Textarea defaultValue={selectedNote.body} className="flex-1 bg-transparent border-0 px-0 resize-none focus-visible:ring-0 text-foreground/90 leading-relaxed text-sm" />

        <div className="flex gap-1.5 mt-3 pt-3 border-t border-white/[0.06]">
          {selectedNote.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-primary/15 text-primary">{tag}</span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
