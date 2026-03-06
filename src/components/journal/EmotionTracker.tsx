import { cn } from "@/lib/utils";

const emotions = [
  { emoji: "😀", label: "Great", value: "great" },
  { emoji: "😐", label: "Neutral", value: "neutral" },
  { emoji: "😰", label: "Anxious", value: "anxious" },
  { emoji: "😡", label: "Frustrated", value: "frustrated" },
];

interface EmotionTrackerProps {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
}

export function EmotionTracker({ label, value, onChange }: EmotionTrackerProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex gap-2">
        {emotions.map((e) => (
          <button
            key={e.value}
            onClick={() => onChange(e.value)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all text-lg",
              value === e.value
                ? "bg-primary/20 border border-primary/40 scale-110"
                : "bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:scale-105"
            )}
          >
            <span>{e.emoji}</span>
            <span className="text-[9px] text-muted-foreground">{e.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
