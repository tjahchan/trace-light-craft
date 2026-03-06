import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface StructuredReflectionProps {
  whatWentWell: string;
  whatWentWrong: string;
  lessonsLearned: string;
  improvements: string;
  onChange: (field: string, value: string) => void;
}

const fields = [
  { key: "whatWentWell", label: "What Went Well", icon: "✅", placeholder: "Describe what worked in this trade..." },
  { key: "whatWentWrong", label: "What Went Wrong", icon: "❌", placeholder: "What could have been better..." },
  { key: "lessonsLearned", label: "Lessons Learned", icon: "💡", placeholder: "Key takeaways from this trade..." },
  { key: "improvements", label: "Improvements", icon: "🎯", placeholder: "What to improve next time..." },
];

export function StructuredReflection({ whatWentWell, whatWentWrong, lessonsLearned, improvements, onChange }: StructuredReflectionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["whatWentWell"]));
  const values: Record<string, string> = { whatWentWell, whatWentWrong, lessonsLearned, improvements };

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Structured Reflection</p>
      {fields.map((f) => {
        const isOpen = expanded.has(f.key);
        return (
          <div key={f.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <button
              onClick={() => toggle(f.key)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground/80 hover:bg-white/[0.03] transition-colors"
            >
              <span>{f.icon}</span>
              <span className="flex-1 text-left">{f.label}</span>
              {values[f.key] && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
              <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="px-3 pb-3">
                <Textarea
                  value={values[f.key]}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="min-h-[60px] bg-transparent border-0 px-0 resize-none focus-visible:ring-0 text-foreground/90 text-xs leading-relaxed"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
