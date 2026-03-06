import { useState, useRef, useEffect } from "react";
import { ChevronRight, Target, Image, MessageSquare } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface BottomToolbarProps {
  onFocusClick: () => void;
  onBackgroundsClick: () => void;
  onFeedbackClick: () => void;
}

const tools = [
  { id: "focus", icon: Target, label: "Focus", key: "onFocusClick" },
  { id: "backgrounds", icon: Image, label: "Backgrounds", key: "onBackgroundsClick" },
  { id: "feedback", icon: MessageSquare, label: "Feedback", key: "onFeedbackClick" },
] as const;

export function BottomToolbar({ onFocusClick, onBackgroundsClick, onFeedbackClick }: BottomToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlers: Record<string, () => void> = {
    onFocusClick,
    onBackgroundsClick,
    onFeedbackClick,
  };

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  return (
    <div ref={containerRef} className="fixed bottom-[88px] left-4 z-[200] flex flex-row items-center gap-2">
      {/* Chevron pill */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setExpanded(!expanded)}
              className="h-10 w-10 rounded-full backdrop-blur-xl bg-black/50 border border-white/[0.12] flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-300"
            >
              <ChevronRight
                className="h-4 w-4 transition-transform duration-300"
                style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
          </TooltipTrigger>
          {!expanded && <TooltipContent side="top">Tools</TooltipContent>}
        </Tooltip>

        {/* Tool icons — expand horizontally to the right */}
        {tools.map((tool, i) => {
          const Icon = tool.icon;
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    handlers[tool.key]();
                    setExpanded(false);
                  }}
                  className="h-9 w-9 rounded-full backdrop-blur-xl bg-black/50 border border-white/[0.12] flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                  style={{
                    opacity: expanded ? 1 : 0,
                    transform: expanded ? "translateX(0px)" : "translateX(-10px)",
                    transition: `all 0.22s ease ${expanded ? i * 60 : (tools.length - 1 - i) * 40}ms`,
                    pointerEvents: expanded ? "auto" : "none",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              {expanded && <TooltipContent side="top">{tool.label}</TooltipContent>}
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
}
