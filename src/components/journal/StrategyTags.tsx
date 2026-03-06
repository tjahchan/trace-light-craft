import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const sessionOptions = ["London", "New York", "Asia", "Sydney", "Overlap"];
const setupOptions = ["Liquidity Sweep", "Order Block", "FVG", "Break of Structure", "Supply/Demand", "Trend Continuation", "Reversal", "Breakout"];

interface StrategyTagsProps {
  strategy: string;
  setup: string;
  session: string;
  onChange: (field: "strategy" | "setup" | "session", value: string) => void;
}

export function StrategyTags({ strategy, setup, session, onChange }: StrategyTagsProps) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Strategy & Session</p>

      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Strategy</label>
          <Input
            value={strategy}
            onChange={(e) => onChange("strategy", e.target.value)}
            placeholder="e.g. London Breakout"
            className="h-8 text-xs bg-white/[0.04] border-white/[0.08]"
          />
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Setup</label>
          <Select value={setup || "__none__"} onValueChange={(v) => onChange("setup", v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs bg-white/[0.04] border-white/[0.08]">
              <SelectValue placeholder="Select setup" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {setupOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Market Session</label>
          <Select value={session || "__none__"} onValueChange={(v) => onChange("session", v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs bg-white/[0.04] border-white/[0.08]">
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {sessionOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
