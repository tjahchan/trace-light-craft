import { useState, useCallback } from "react";
import { Sparkles, BookOpen, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { usePlan } from "@/contexts/PlanContext";
import { Lock } from "lucide-react";

interface AiInsightPanelProps {
  content: string;
  mode: "trade" | "note";
  tradeContext?: {
    symbol?: string;
    side?: string;
    pnl?: number | null;
    entry_price?: number;
    exit_price?: number | null;
    session?: string;
  };
}

export function AiInsightPanel({ content, mode, tradeContext }: AiInsightPanelProps) {
  const { canUseJournalInsights, triggerUpgrade } = usePlan();
  const [expanded, setExpanded] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [lessonsResult, setLessonsResult] = useState("");
  const [loading, setLoading] = useState<"analyze" | "lessons" | null>(null);

  const buildSystemPrompt = (type: "analyze" | "lessons") => {
    const base = mode === "trade"
      ? `You are Momentra AI, a professional trading coach. Analyze the trader's journal entry for a ${tradeContext?.symbol || "unknown"} ${tradeContext?.side || ""} trade (PnL: ${tradeContext?.pnl != null ? `$${tradeContext.pnl.toFixed(2)}` : "N/A"}, Entry: ${tradeContext?.entry_price}, Exit: ${tradeContext?.exit_price ?? "N/A"}, Session: ${tradeContext?.session || "N/A"}).`
      : "You are Momentra AI, a professional trading coach. Analyze the trader's note or strategy document.";

    if (type === "analyze") {
      return `${base}\n\nProvide a concise analysis with exactly three sections using these markdown headers:\n## Trade Summary\nBrief summary of the trade/note.\n## Key Strength\nOne key strength identified.\n## Improvement Suggestion\nOne actionable improvement.\n\nKeep each section to 1-2 sentences. Be specific and constructive.`;
    }
    return `${base}\n\nExtract 3-5 concise, actionable lessons from this entry. Format as a markdown bullet list under the header:\n## Lessons Extracted\nKeep each lesson to one sentence.`;
  };

  const streamAI = useCallback(async (type: "analyze" | "lessons") => {
    if (!content.trim()) return;
    setLoading(type);
    setExpanded(true);
    const setter = type === "analyze" ? setAnalysisResult : setLessonsResult;
    setter("");

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/momentra-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            systemPrompt: buildSystemPrompt(type),
            messages: [{ role: "user", content: content.substring(0, 4000) }],
          }),
        }
      );

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        setter(`Error: ${(errData as any).error || "AI service unavailable"}`);
        setLoading(null);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setter(accumulated);
            }
          } catch {}
        }
      }
    } catch (e) {
      setter("Error: Could not reach AI service.");
    }
    setLoading(null);
  }, [content, mode, tradeContext]);

  const hasOutput = analysisResult || lessonsResult;

  if (!canUseJournalInsights) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden">
        <button
          onClick={() => triggerUpgrade("Upgrade to Pro to unlock AI trade insights in your journal.")}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-primary/15 flex items-center justify-center">
              <Lock className="h-3 w-3 text-muted-foreground" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground tracking-wide">AI Insight</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">PRO</span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden"
      style={{ boxShadow: "0 0 20px -4px hsl(217 91% 60% / 0.08)" }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-primary/15 flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground tracking-wide">AI Insight</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => streamAI("analyze")}
              disabled={loading !== null || !content.trim()}
              className="h-7 text-[10px] gap-1.5 border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06]"
            >
              {loading === "analyze" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Analyze Entry
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => streamAI("lessons")}
              disabled={loading !== null || !content.trim()}
              className="h-7 text-[10px] gap-1.5 border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06]"
            >
              {loading === "lessons" ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
              Extract Lessons
            </Button>
          </div>

          {/* Results */}
          {!hasOutput && !loading && (
            <p className="text-[10px] text-muted-foreground/50 italic">
              Write your journal entry, then click a button to get AI insights.
            </p>
          )}

          {analysisResult && (
            <div className="text-xs text-foreground/85 leading-relaxed prose prose-invert prose-sm max-w-none
              prose-h2:text-[11px] prose-h2:font-semibold prose-h2:text-primary prose-h2:uppercase prose-h2:tracking-wider prose-h2:mt-3 prose-h2:mb-1
              prose-p:text-[11px] prose-p:my-1">
              <ReactMarkdown>{analysisResult}</ReactMarkdown>
            </div>
          )}

          {lessonsResult && (
            <div className={cn("text-xs text-foreground/85 leading-relaxed prose prose-invert prose-sm max-w-none",
              "prose-h2:text-[11px] prose-h2:font-semibold prose-h2:text-primary prose-h2:uppercase prose-h2:tracking-wider prose-h2:mt-3 prose-h2:mb-1",
              "prose-p:text-[11px] prose-p:my-1 prose-li:text-[11px]",
              analysisResult && "border-t border-white/[0.06] pt-3"
            )}>
              <ReactMarkdown>{lessonsResult}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
