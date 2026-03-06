import { useState } from "react";
import { motion, type Easing } from "framer-motion";
import { BookOpen, BarChart3, FolderOpen, CheckCircle2, Activity } from "lucide-react";

const ease: Easing = [0.22, 1, 0.36, 1];

/* ─── Interactive mini-demo ─── */
function InteractiveDemo() {
  const [activeField, setActiveField] = useState<string | null>(null);
  const fields = [
    { id: "well", label: "What went well", emoji: "✅", content: "Entry was perfectly timed on the London open. Waited for confirmation before entering. Risk was controlled at 1% of account." },
    { id: "wrong", label: "What went wrong", emoji: "⚠️", content: "Moved stop loss too early. Should have given more room for the initial pullback. Exited 20 pips before target." },
    { id: "lessons", label: "Lessons learned", emoji: "💡", content: "Trust the setup. The pullback was within normal range. Set and forget is better for this strategy type." },
  ];

  return (
    <div className="glass-card p-5 space-y-3 max-w-sm">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Structured Reflection</p>
      {fields.map((f) => (
        <button
          key={f.id}
          onClick={() => setActiveField(activeField === f.id ? null : f.id)}
          className={`w-full text-left p-3 rounded-xl border transition-all duration-300 ${
            activeField === f.id
              ? "bg-primary/5 border-primary/20"
              : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{f.emoji}</span>
            <span className="text-xs font-medium text-foreground">{f.label}</span>
          </div>
          {activeField === f.id && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="text-[11px] text-muted-foreground mt-2 leading-relaxed"
            >
              {f.content}
            </motion.p>
          )}
        </button>
      ))}
    </div>
  );
}

/* ─── Mock journal with trade details ─── */
function MockJournalView() {
  return (
    <div className="glass-card p-5 space-y-4 max-w-sm">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="h-4 w-4 text-primary/60" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Journal + Trade Details</p>
      </div>
      {/* Trade info bar */}
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-foreground">EUR/USD</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-profit/10 text-profit">Long</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[8px] text-muted-foreground uppercase">Entry</p>
            <p className="text-[10px] font-mono text-foreground">1.0845</p>
          </div>
          <div>
            <p className="text-[8px] text-muted-foreground uppercase">Exit</p>
            <p className="text-[10px] font-mono text-foreground">1.0892</p>
          </div>
          <div>
            <p className="text-[8px] text-muted-foreground uppercase">P&L</p>
            <p className="text-[10px] font-mono text-profit">+$335</p>
          </div>
        </div>
      </div>
      {/* Journal content */}
      <div className="space-y-2">
        <div className="h-2.5 w-3/4 rounded bg-foreground/10" />
        <div className="h-2 w-full rounded bg-foreground/5" />
        <div className="h-2 w-5/6 rounded bg-foreground/5" />
      </div>
      {/* Chart placeholder */}
      <div className="h-20 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
        <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Chart Screenshot</span>
      </div>
    </div>
  );
}

/* ─── Mock analytics ─── */
function MockAnalytics() {
  const bars = [65, 80, 45, 90, 72, 88, 55, 95, 78, 60];
  return (
    <div className="glass-card p-5 space-y-4 max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Performance</p>
        <span className="text-xs font-mono text-profit">+$1,186.00</span>
      </div>
      <div className="flex items-end gap-1 h-24">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.06, ease }}
            className={`flex-1 rounded-sm ${h > 60 ? "bg-profit/40" : "bg-loss/30"}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <p className="text-[8px] text-muted-foreground uppercase">Win Rate</p>
          <p className="text-sm font-mono font-semibold text-profit">80%</p>
        </div>
        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <p className="text-[8px] text-muted-foreground uppercase">Avg R</p>
          <p className="text-sm font-mono font-semibold text-foreground">1.8R</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Mock playbook ─── */
function MockPlaybook() {
  const folders = [
    { name: "Trade Journals", count: 24, active: true },
    { name: "Strategies", count: 8 },
    { name: "Psychology", count: 5 },
    { name: "Learning", count: 12 },
  ];
  return (
    <div className="glass-card p-5 space-y-3 max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <FolderOpen className="h-4 w-4 text-primary/60" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Trading Playbook</p>
      </div>
      {folders.map((f) => (
        <div
          key={f.name}
          className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
            f.active ? "bg-primary/5 border-primary/15" : "bg-white/[0.02] border-white/[0.05]"
          }`}
        >
          <div className="flex items-center gap-2">
            <FolderOpen className={`h-3.5 w-3.5 ${f.active ? "text-primary" : "text-muted-foreground/50"}`} />
            <span className="text-xs font-medium text-foreground">{f.name}</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{f.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Feature data ─── */
const features = [
  {
    id: "journaling",
    icon: BookOpen,
    label: "Trade Journaling",
    title: "Journal with full trade context",
    desc: "Write detailed trade reviews alongside your trade data. See entry, exit, P&L, and chart screenshots while you reflect — so nothing gets lost. Your journal becomes a searchable trading knowledge base.",
    highlights: ["Trade details panel", "Chart screenshots", "Strategy tagging", "Structured reflection"],
    visual: "journal",
  },
  {
    id: "analytics",
    icon: BarChart3,
    label: "Trade Analytics",
    title: "See patterns your intuition misses",
    desc: "Visualize win rate, R-multiples, risk analysis, and PnL curves. Spot which sessions, setups, and emotions lead to your best — and worst — trades.",
    highlights: ["Win rate analysis", "R-multiple tracking", "Session performance", "Risk analysis"],
    visual: "analytics",
  },
  {
    id: "livepnl",
    icon: Activity,
    label: "Live PnL Tracking",
    title: "Monitor live PnL in real time",
    desc: "See your live profit and loss directly in the open orders and positions section. Stay aware of risk and performance as your trades unfold — no tab-switching required.",
    highlights: ["Real-time P&L", "Open position tracking", "Risk awareness", "Instant updates"],
    visual: "demo",
  },
  {
    id: "playbook",
    icon: FolderOpen,
    label: "Trading Playbook",
    title: "Your personal trading library",
    desc: "Organize strategies, psychology notes, trade breakdowns, and learning materials in folders. Build a searchable knowledge base that compounds your trading edge over time.",
    highlights: ["Strategy folders", "Learning notes", "Psychology journals", "Searchable archive"],
    visual: "playbook",
  },
];

export function LandingProduct() {
  return (
    <section id="features" className="relative py-32 px-6 md:px-12">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 blur-[200px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease }}
          className="text-center mb-20"
        >
          <span className="text-[11px] font-medium text-primary uppercase tracking-[0.2em] mb-4 block">Product</span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">
            Your Entire Trading System<br className="hidden md:block" /> in One Place
          </h2>
        </motion.div>

        <div className="space-y-32">
          {features.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease }}
              className={`flex flex-col ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-12 md:gap-16`}
            >
              {/* Text */}
              <div className="flex-1 space-y-5">
                <div className="flex items-center gap-2">
                  <f.icon className="h-5 w-5 text-primary/70" />
                  <span className="text-[11px] font-medium text-primary uppercase tracking-[0.15em]">{f.label}</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {f.highlights.map((h) => (
                    <div key={h} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                      <span className="text-sm text-muted-foreground">{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual */}
              <div className="flex-1 flex justify-center">
                {f.visual === "journal" && <MockJournalView />}
                {f.visual === "demo" && <InteractiveDemo />}
                {f.visual === "analytics" && <MockAnalytics />}
                {f.visual === "playbook" && <MockPlaybook />}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
