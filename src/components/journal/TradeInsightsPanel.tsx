import { cn } from "@/lib/utils";
import { EmotionTracker } from "./EmotionTracker";
import { DisciplineSliders } from "./DisciplineSliders";
import { StrategyTags } from "./StrategyTags";
import { MistakeTags } from "./MistakeTags";
import { ScrollArea } from "@/components/ui/scroll-area";
import { calculateRiskPercent } from "@/lib/trade-utils";

interface TradeData {
  symbol: string;
  side: string;
  quantity: number;
  entry_price: number;
  exit_price: number | null;
  pnl: number | null;
  sl: number | null;
  tp: number | null;
  tags: string[];
}

interface JournalMeta {
  emotion_before: string | null;
  emotion_after: string | null;
  confidence: number;
  execution: number;
  discipline: number;
  strategy: string;
  setup: string;
  session: string;
  mistakes: string[];
}

interface TradeInsightsPanelProps {
  trade: TradeData;
  meta: JournalMeta;
  accountBalance: number;
  onMetaChange: (updates: Partial<JournalMeta>) => void;
}

export function TradeInsightsPanel({ trade, meta, accountBalance, onMetaChange }: TradeInsightsPanelProps) {
  const pnl = trade.pnl ?? 0;
  const riskPercent = calculateRiskPercent(trade.entry_price, trade.sl, trade.quantity, trade.symbol, accountBalance);
  const rMultiple = trade.sl && trade.entry_price
    ? (pnl / (Math.abs(trade.entry_price - trade.sl) * trade.quantity * 100000)).toFixed(1)
    : "—";

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        {/* Performance header */}
        <div className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Trade Result</p>
          <p className={cn("text-2xl font-mono font-bold", pnl >= 0 ? "text-profit" : "text-loss")}>
            {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
          </p>
          {rMultiple !== "—" && (
            <p className={cn("text-sm font-mono mt-0.5", pnl >= 0 ? "text-profit/70" : "text-loss/70")}>
              {pnl >= 0 ? "+" : ""}{rMultiple}R
            </p>
          )}
        </div>

        {/* Trade stats grid */}
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Trade Details</p>
          <div className="grid grid-cols-2 gap-1.5">
            <StatCard label="Symbol" value={trade.symbol} />
            <StatCard label="Side" value={trade.side} valueClass={trade.side === "Long" ? "text-profit" : "text-loss"} />
            <StatCard label="Position Size" value={trade.quantity.toString()} />
            <StatCard label="Risk %" value={riskPercent ? `${riskPercent.toFixed(1)}%` : "—"} />
            <StatCard label="Entry" value={`$${trade.entry_price}`} mono />
            <StatCard label="Exit" value={trade.exit_price ? `$${trade.exit_price}` : "—"} mono />
            <StatCard label="Stop Loss" value={trade.sl ? `$${trade.sl}` : "—"} mono />
            <StatCard label="Take Profit" value={trade.tp ? `$${trade.tp}` : "—"} mono />
          </div>
        </div>

        {/* Strategy & Session */}
        <StrategyTags
          strategy={meta.strategy}
          setup={meta.setup}
          session={meta.session}
          onChange={(field, value) => onMetaChange({ [field]: value })}
        />

        {/* Emotion tracking */}
        <EmotionTracker
          label="Emotion Before Trade"
          value={meta.emotion_before}
          onChange={(v) => onMetaChange({ emotion_before: v })}
        />
        <EmotionTracker
          label="Emotion After Trade"
          value={meta.emotion_after}
          onChange={(v) => onMetaChange({ emotion_after: v })}
        />

        {/* Discipline */}
        <DisciplineSliders
          confidence={meta.confidence}
          execution={meta.execution}
          discipline={meta.discipline}
          onChange={(field, value) => onMetaChange({ [field]: value })}
        />

        {/* Mistake tags */}
        <MistakeTags
          selected={meta.mistakes}
          onChange={(mistakes) => onMetaChange({ mistakes })}
        />

        {/* Trade tags */}
        {trade.tags && trade.tags.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Trade Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {trade.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-primary/15 text-primary border border-primary/20">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function StatCard({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn("text-xs font-medium text-foreground mt-0.5", mono && "font-mono", valueClass)}>{value}</p>
    </div>
  );
}
