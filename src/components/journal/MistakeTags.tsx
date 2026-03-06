import { cn } from "@/lib/utils";

const mistakeOptions = [
  "Overtrading",
  "FOMO",
  "Revenge Trading",
  "Late Entry",
  "Oversized Position",
  "No Stop Loss",
  "Moved Stop",
  "Early Exit",
  "Ignored Plan",
  "Emotional Decision",
];

interface MistakeTagsProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MistakeTags({ selected, onChange }: MistakeTagsProps) {
  const toggle = (tag: string) => {
    onChange(
      selected.includes(tag)
        ? selected.filter((t) => t !== tag)
        : [...selected, tag]
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Mistake Tags</p>
      <div className="flex flex-wrap gap-1.5">
        {mistakeOptions.map((tag) => (
          <button
            key={tag}
            onClick={() => toggle(tag)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border",
              selected.includes(tag)
                ? "bg-destructive/20 border-destructive/40 text-destructive"
                : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            )}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
