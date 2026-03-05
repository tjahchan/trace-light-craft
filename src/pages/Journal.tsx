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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Note {
  id: string;
  title: string;
  body: string;
  folder: string;
  date: string;
  tags: string[];
}

const defaultNotes: Note[] = [
  {
    id: "1",
    title: "London Breakout Review",
    body: "Tested the London breakout strategy on GBP/USD. Entry was clean at the 08:00 UTC candle break. Need to work on position sizing — went too heavy at 2% risk.",
    folder: "Day Trading",
    date: "2026-03-04",
    tags: ["Strategy", "GBP/USD"],
  },
  {
    id: "2",
    title: "Weekly Trading Plan",
    body: "Focus on EUR/USD and GBP/JPY this week. Key levels marked on the chart. Avoid trading during FOMC announcement on Wednesday.",
    folder: "General",
    date: "2026-03-03",
    tags: ["Planning"],
  },
  {
    id: "3",
    title: "ICT Order Block Notes",
    body: "Order blocks form when institutional traders place large orders. Look for the last bearish candle before a bullish impulse move. Mark the body of that candle as the order block zone.",
    folder: "Strategy Notes",
    date: "2026-03-01",
    tags: ["ICT", "Education"],
  },
];

const folders = ["Day Trading", "General", "Strategy Notes"];

export default function Journal() {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note>(defaultNotes[0]);

  const filteredNotes = selectedFolder
    ? defaultNotes.filter((n) => n.folder === selectedFolder)
    : defaultNotes;

  return (
    <div className="flex gap-4 h-[calc(100vh-7rem)]">
      {/* Left Panel — Folders & Notes */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-64 shrink-0 glass-card p-3 flex flex-col"
      >
        <div className="flex gap-2 mb-3">
          <Button size="sm" variant="outline" className="flex-1 text-xs glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
            <Plus className="h-3 w-3 mr-1" /> Note
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
            <FolderOpen className="h-3 w-3 mr-1" /> Folder
          </Button>
        </div>

        {/* Folders */}
        <div className="space-y-0.5 mb-3">
          <button
            onClick={() => setSelectedFolder(null)}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              !selectedFolder ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            }`}
          >
            All Notes
          </button>
          {folders.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFolder(f)}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                selectedFolder === f ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`}
            >
              <FolderOpen className="h-3 w-3" /> {f}
            </button>
          ))}
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-auto space-y-1">
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              onClick={() => setSelectedNote(note)}
              className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors ${
                selectedNote.id === note.id
                  ? "bg-white/[0.08]"
                  : "hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground truncate">{note.title}</span>
              </div>
              <span className="text-[10px] text-muted-foreground ml-4.5">{note.date}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Right Panel — Editor */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 glass-card p-6 flex flex-col min-w-0"
      >
        <Input
          defaultValue={selectedNote.title}
          className="text-xl font-semibold bg-transparent border-0 px-0 focus-visible:ring-0 text-foreground mb-1"
        />
        <p className="text-xs text-muted-foreground mb-4">{selectedNote.date}</p>

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

        {/* Editor Body */}
        <Textarea
          defaultValue={selectedNote.body}
          className="flex-1 bg-transparent border-0 px-0 resize-none focus-visible:ring-0 text-foreground/90 leading-relaxed text-sm"
        />

        {/* Tags */}
        <div className="flex gap-1.5 mt-3 pt-3 border-t border-white/[0.06]">
          {selectedNote.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] bg-primary/15 text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
