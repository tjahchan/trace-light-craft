import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Sparkles, BookOpen, ArrowRight } from "lucide-react";

interface TourStep {
  targetSelector?: string;
  title: string;
  text: string | React.ReactNode;
  type: "modal" | "spotlight";
}

const tourSteps: TourStep[] = [
  {
    type: "modal",
    title: "Welcome to Momentra",
    text: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          Your trading edge is built through reflection, discipline, and learning.
        </p>
        <div className="space-y-2 text-sm">
          <p className="text-foreground/80">Momentra helps you:</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Record trades with precision</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Analyze every decision</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Build your personal trading playbook</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    type: "spotlight",
    targetSelector: "[data-tour='notebook-sidebar']",
    title: "Your Trading Notebook",
    text: (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground leading-relaxed">
          This is your trading notebook. Organize your knowledge with folders for:
        </p>
        <ul className="space-y-1 text-muted-foreground text-xs">
          <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Trade journals</li>
          <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Strategies</li>
          <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Psychology notes</li>
          <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Learning material</li>
        </ul>
        <p className="text-foreground/60 text-xs italic mt-2">Your journal becomes your personal trading library.</p>
      </div>
    ),
  },
  {
    type: "spotlight",
    targetSelector: "[data-tour='mode-toggle']",
    title: "Notes vs Trades",
    text: (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground leading-relaxed">Momentra separates two powerful workflows.</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-2">
            <p className="text-foreground text-xs font-medium mb-0.5">Notes</p>
            <p className="text-muted-foreground text-[10px]">Your trading knowledge base.</p>
          </div>
          <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-2">
            <p className="text-foreground text-xs font-medium mb-0.5">Trades</p>
            <p className="text-muted-foreground text-[10px]">Your recorded trade reflections.</p>
          </div>
        </div>
        <p className="text-foreground/60 text-xs">Switch between them anytime.</p>
      </div>
    ),
  },
  {
    type: "spotlight",
    targetSelector: "[data-tour='new-button']",
    title: "Create a New Entry",
    text: (
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
        <p>Create new entries whenever inspiration strikes.</p>
        <p className="text-xs">Use it to add trade journals, strategy ideas, trading lessons, or psychology reflections.</p>
      </div>
    ),
  },
  {
    type: "spotlight",
    targetSelector: "[data-tour='editor-area']",
    title: "The Journal Editor",
    text: (
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
        <p>Write detailed reflections on your trades.</p>
        <p className="text-xs">Top traders constantly review their decisions and document their thinking.</p>
        <p className="text-foreground/60 text-xs italic">Your future self will thank you.</p>
      </div>
    ),
  },
  {
    type: "spotlight",
    targetSelector: "[data-tour='chart-screenshots']",
    title: "Chart Screenshots",
    text: (
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
        <p>Attach chart screenshots to your entries.</p>
        <p className="text-xs">Add entry setups, market structure, and exit points. Visual review dramatically improves learning.</p>
      </div>
    ),
  },
  {
    type: "spotlight",
    targetSelector: "[data-tour='structured-reflection']",
    title: "Structured Reflection",
    text: (
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
        <p>Great traders review every trade.</p>
        <p className="text-xs">Break down your decisions with: What went well, What went wrong, Lessons learned, and Improvements.</p>
        <p className="text-foreground/60 text-xs italic">Reflection turns experience into skill.</p>
      </div>
    ),
  },
  {
    type: "spotlight",
    targetSelector: "[data-tour='trade-insights']",
    title: "Trade Insights Panel",
    text: (
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
        <p>Your trade data is summarized here.</p>
        <p className="text-xs">Quickly review entry & exit, position size, risk, strategy & session. Combine data with reflection to understand your performance.</p>
      </div>
    ),
  },
  {
    type: "spotlight",
    targetSelector: "[data-tour='ai-insight']",
    title: "AI Trading Coach",
    text: (
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
        <p>Meet your AI trading coach.</p>
        <p className="text-xs">Analyze journal entries to summarize trades, extract key lessons, and identify improvement opportunities.</p>
        <p className="text-foreground/60 text-xs italic">Turn your notes into actionable insights.</p>
      </div>
    ),
  },
  {
    type: "modal",
    title: "Your Edge Starts Here",
    text: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed text-sm">
          The best traders review their performance every day.
        </p>
        <div className="space-y-2 text-sm">
          <p className="text-foreground/80">Use Momentra to:</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Journal your trades</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Store strategies</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Track lessons</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Refine your edge</li>
          </ul>
        </div>
      </div>
    ),
  },
];

const STORAGE_KEY = "momentra-journal-tour-completed";

interface Props {
  onCreateEntry?: () => void;
}

export function JournalOnboardingTour({ onCreateEntry }: Props) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; placement: "top" | "bottom" | "left" | "right" }>({
    top: 0,
    left: 0,
    placement: "bottom",
  });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Auto-start on first visit
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const currentStep = tourSteps[step];

  const updateSpotlight = useCallback(() => {
    if (!currentStep || currentStep.type === "modal") {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(currentStep.targetSelector!);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);

      // Calculate tooltip position
      const padding = 16;
      const tooltipW = 320;
      const tooltipH = 260;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let placement: "top" | "bottom" | "left" | "right" = "right";
      let top = rect.top;
      let left = rect.right + padding;

      // Prefer right, fall back to bottom, then left
      if (left + tooltipW > vw - padding) {
        // Try left
        if (rect.left - tooltipW - padding > padding) {
          placement = "left";
          left = rect.left - tooltipW - padding;
        } else {
          // Bottom
          placement = "bottom";
          top = rect.bottom + padding;
          left = Math.max(padding, Math.min(rect.left, vw - tooltipW - padding));
        }
      }

      // Vertical clamping
      if (placement === "right" || placement === "left") {
        top = Math.max(padding, Math.min(top, vh - tooltipH - padding));
      }
      if (placement === "bottom" && top + tooltipH > vh - padding) {
        placement = "top";
        top = rect.top - tooltipH - padding;
        left = Math.max(padding, Math.min(rect.left, vw - tooltipW - padding));
      }

      setTooltipPos({ top, left, placement });
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!active) return;
    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    return () => window.removeEventListener("resize", updateSpotlight);
  }, [active, step, updateSpotlight]);

  const next = () => {
    if (step < tourSteps.length - 1) setStep(step + 1);
  };
  const prev = () => {
    if (step > 0) setStep(step - 1);
  };
  const skip = () => {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };
  const finish = () => {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, "true");
    onCreateEntry?.();
  };
  const startTour = () => {
    setStep(0);
    setActive(true);
  };

  const isFirst = step === 0;
  const isLast = step === tourSteps.length - 1;

  return (
    <>
      {/* "Take the Tour" button — always visible */}
      {!active && (
        <button
          onClick={startTour}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors backdrop-blur-md"
        >
          <BookOpen className="h-3 w-3" />
          Take the Tour
        </button>
      )}

      <AnimatePresence>
        {active && (
          <>
            {/* Overlay with spotlight cutout */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="fixed inset-0 z-[100]"
              style={{ pointerEvents: "auto" }}
            >
              {/* Dark overlay */}
              <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
                <defs>
                  <mask id="tour-spotlight-mask">
                    <rect x="0" y="0" width="100%" height="100%" fill="white" />
                    {spotlightRect && (
                      <rect
                        x={spotlightRect.left - 8}
                        y={spotlightRect.top - 8}
                        width={spotlightRect.width + 16}
                        height={spotlightRect.height + 16}
                        rx="16"
                        fill="black"
                      />
                    )}
                  </mask>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="rgba(0,0,0,0.75)"
                  mask="url(#tour-spotlight-mask)"
                />
              </svg>

              {/* Spotlight glow ring */}
              {spotlightRect && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className="absolute rounded-2xl pointer-events-none"
                  style={{
                    left: spotlightRect.left - 10,
                    top: spotlightRect.top - 10,
                    width: spotlightRect.width + 20,
                    height: spotlightRect.height + 20,
                    boxShadow: "0 0 0 2px hsl(var(--primary) / 0.5), 0 0 30px 4px hsl(var(--primary) / 0.15)",
                  }}
                />
              )}

              {/* Click blocker for non-target areas */}
              <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

              {/* Centered modal for intro/outro steps */}
              {currentStep.type === "modal" && (
                <motion.div
                  key={`modal-${step}`}
                  initial={{ opacity: 0, scale: 0.92, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 20 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="relative w-full max-w-md mx-4 rounded-2xl border border-white/[0.1] bg-black/80 backdrop-blur-2xl p-8 shadow-2xl"
                    style={{ boxShadow: "0 0 60px 10px hsl(var(--primary) / 0.08), 0 25px 50px -12px rgba(0,0,0,0.7)" }}
                  >
                    {/* Close */}
                    <button onClick={skip} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>

                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>

                    <h2 className="text-xl font-semibold text-foreground mb-3 tracking-tight">{currentStep.title}</h2>
                    {currentStep.text}

                    {/* Step counter */}
                    <div className="flex items-center justify-between mt-8">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Step {step + 1} of {tourSteps.length}
                      </span>
                      <div className="flex items-center gap-2">
                        {!isFirst && (
                          <Button variant="ghost" size="sm" onClick={prev} className="h-8 text-xs gap-1">
                            <ChevronLeft className="h-3 w-3" /> Back
                          </Button>
                        )}
                        {isFirst && (
                          <Button variant="ghost" size="sm" onClick={skip} className="h-8 text-xs text-muted-foreground">
                            Skip Tour
                          </Button>
                        )}
                        {isLast ? (
                          <Button size="sm" onClick={finish} className="h-8 text-xs gap-1.5">
                            Create Your First Entry <ArrowRight className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button size="sm" onClick={next} className="h-8 text-xs gap-1">
                            {isFirst ? "Start the Tour" : "Next"} <ChevronRight className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Progress dots */}
                    <div className="flex items-center justify-center gap-1 mt-4">
                      {tourSteps.map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1 rounded-full transition-all duration-300",
                            i === step ? "w-4 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-white/10"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Spotlight tooltip */}
              {currentStep.type === "spotlight" && spotlightRect && (
                <motion.div
                  ref={tooltipRef}
                  key={`tooltip-${step}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute z-[110] w-[320px]"
                  style={{ top: tooltipPos.top, left: tooltipPos.left }}
                >
                  <div className="rounded-2xl border border-white/[0.1] bg-black/85 backdrop-blur-2xl p-5 shadow-2xl"
                    style={{ boxShadow: "0 0 40px 6px hsl(var(--primary) / 0.06), 0 20px 40px -12px rgba(0,0,0,0.6)" }}
                  >
                    <h3 className="text-sm font-semibold text-foreground mb-2 tracking-tight">{currentStep.title}</h3>
                    {currentStep.text}

                    {/* Controls */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.06]">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {step + 1} / {tourSteps.length}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="sm" onClick={skip} className="h-7 text-[10px] text-muted-foreground px-2">
                          Skip
                        </Button>
                        {step > 0 && (
                          <Button variant="ghost" size="sm" onClick={prev} className="h-7 text-[10px] gap-0.5 px-2">
                            <ChevronLeft className="h-3 w-3" /> Back
                          </Button>
                        )}
                        <Button size="sm" onClick={next} className="h-7 text-[10px] gap-0.5 px-3">
                          Next <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress dots */}
                    <div className="flex items-center justify-center gap-1 mt-3">
                      {tourSteps.map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-0.5 rounded-full transition-all duration-300",
                            i === step ? "w-3 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-white/10"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Fallback: if spotlight target not found, show as modal */}
              {currentStep.type === "spotlight" && !spotlightRect && (
                <motion.div
                  key={`fallback-${step}`}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.35 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-white/[0.1] bg-black/85 backdrop-blur-2xl p-6 shadow-2xl">
                    <h3 className="text-sm font-semibold text-foreground mb-2">{currentStep.title}</h3>
                    {currentStep.text}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.06]">
                      <span className="text-[10px] text-muted-foreground font-mono">{step + 1} / {tourSteps.length}</span>
                      <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="sm" onClick={skip} className="h-7 text-[10px] px-2">Skip</Button>
                        {step > 0 && (
                          <Button variant="ghost" size="sm" onClick={prev} className="h-7 text-[10px] gap-0.5 px-2">
                            <ChevronLeft className="h-3 w-3" /> Back
                          </Button>
                        )}
                        {isLast ? (
                          <Button size="sm" onClick={finish} className="h-7 text-[10px] gap-0.5 px-3">
                            Create Entry <ArrowRight className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button size="sm" onClick={next} className="h-7 text-[10px] gap-0.5 px-3">
                            Next <ChevronRight className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
