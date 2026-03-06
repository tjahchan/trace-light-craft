import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Sparkles, ArrowRight } from "lucide-react";
import { useOnboarding } from "@/contexts/OnboardingContext";

interface TourStep {
  path: string;
  targetSelector?: string;
  title: string;
  text: string;
  type: "modal" | "spotlight";
}

const tourSteps: TourStep[] = [
  {
    path: "/",
    type: "modal",
    title: "Welcome to Momentra",
    text: "Your trading edge is built through reflection, discipline, and learning. Let us show you around.",
  },
  {
    path: "/",
    type: "spotlight",
    targetSelector: "[data-tour='streak-card']",
    title: "Your Streak",
    text: "Track your daily journaling streak. Consistency builds discipline — the foundation of profitable trading.",
  },
  {
    path: "/",
    type: "spotlight",
    targetSelector: "[data-tour='balance-card']",
    title: "Account Overview",
    text: "Monitor your balance, PnL, and equity curve in real-time. Import trades manually, via CSV, or sync with your broker.",
  },
  {
    path: "/overview",
    type: "spotlight",
    targetSelector: "[data-tour='overview-calendar']",
    title: "Performance Calendar",
    text: "Visualize your trading activity day by day. Spot patterns, review winning streaks, and identify areas for improvement.",
  },
  {
    path: "/overview",
    type: "spotlight",
    targetSelector: "[data-tour='overview-stats']",
    title: "Trading Statistics",
    text: "Deep-dive into your performance: win rate, average RR, profit factor, and more. Data-driven improvement.",
  },
  {
    path: "/journal",
    type: "spotlight",
    targetSelector: "[data-tour='notebook-sidebar']",
    title: "Your Trading Notebook",
    text: "Organize your knowledge with folders for trade journals, strategies, psychology notes, and learning material.",
  },
  {
    path: "/journal",
    type: "spotlight",
    targetSelector: "[data-tour='new-button']",
    title: "Create Entries",
    text: "Add trade journals, strategy ideas, trading lessons, or psychology reflections whenever inspiration strikes.",
  },
  {
    path: "/community",
    type: "spotlight",
    targetSelector: "[data-tour='leaderboard']",
    title: "Leaderboard",
    text: "Compare your streak and performance with other traders. Stay motivated and accountable.",
  },
  {
    path: "/",
    type: "modal",
    title: "You're Ready",
    text: "Explore with sample data, or start fresh. You can revisit this tour anytime from the top navigation.",
  },
];

export function PlatformTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tourActive, tourStep, setTourStep, setTourActive, completeTour } = useOnboarding();
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [navigating, setNavigating] = useState(false);
  const retryRef = useRef<NodeJS.Timeout>();

  const currentStep = tourSteps[tourStep];
  const isFirst = tourStep === 0;
  const isLast = tourStep === tourSteps.length - 1;

  const updateSpotlight = useCallback(() => {
    if (!currentStep || currentStep.type === "modal" || !currentStep.targetSelector) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
      
      const padding = 16;
      const tooltipW = 340;
      const tooltipH = 180;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      let top = rect.top;
      let left = rect.right + padding;
      
      if (left + tooltipW > vw - padding) {
        if (rect.left - tooltipW - padding > padding) {
          left = rect.left - tooltipW - padding;
        } else {
          top = rect.bottom + padding;
          left = Math.max(padding, Math.min(rect.left, vw - tooltipW - padding));
        }
      }
      top = Math.max(padding, Math.min(top, vh - tooltipH - padding));
      
      setTooltipPos({ top, left });
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep]);

  // Navigate to the correct page for each step
  useEffect(() => {
    if (!tourActive || !currentStep) return;
    
    if (location.pathname !== currentStep.path) {
      setNavigating(true);
      navigate(currentStep.path);
      // Wait for page to render
      retryRef.current = setTimeout(() => {
        setNavigating(false);
        updateSpotlight();
      }, 800);
      return () => { if (retryRef.current) clearTimeout(retryRef.current); };
    } else {
      setNavigating(false);
      // Small delay to let DOM render
      const t = setTimeout(updateSpotlight, 200);
      return () => clearTimeout(t);
    }
  }, [tourActive, tourStep, location.pathname, currentStep, navigate, updateSpotlight]);

  useEffect(() => {
    if (!tourActive) return;
    window.addEventListener("resize", updateSpotlight);
    return () => window.removeEventListener("resize", updateSpotlight);
  }, [tourActive, updateSpotlight]);

  const next = () => {
    if (tourStep < tourSteps.length - 1) setTourStep(tourStep + 1);
  };
  const prev = () => {
    if (tourStep > 0) setTourStep(tourStep - 1);
  };
  const skip = () => {
    completeTour();
  };
  const finish = () => {
    completeTour();
    navigate("/");
  };

  if (!tourActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[200]"
      >
        {/* Dark overlay with spotlight cutout */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          <defs>
            <mask id="platform-tour-mask">
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
          <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#platform-tour-mask)" />
        </svg>

        {/* Glow ring */}
        {spotlightRect && (
          <motion.div
            key={`ring-${tourStep}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
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

        {/* Click blocker */}
        <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

        {/* Loading state during navigation */}
        {navigating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Modal steps (intro/outro) */}
        {!navigating && currentStep.type === "modal" && (
          <motion.div
            key={`modal-${tourStep}`}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div
              className="relative w-full max-w-md mx-4 rounded-2xl border border-white/[0.1] bg-black/85 backdrop-blur-2xl p-8 shadow-2xl"
              style={{ boxShadow: "0 0 60px 10px hsl(var(--primary) / 0.08), 0 25px 50px -12px rgba(0,0,0,0.7)" }}
            >
              <button onClick={skip} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-3 tracking-tight">{currentStep.title}</h2>
              <p className="text-muted-foreground leading-relaxed text-sm">{currentStep.text}</p>
              
              <div className="flex items-center justify-between mt-8">
                <div className="flex items-center gap-1">
                  {tourSteps.map((_, i) => (
                    <div key={i} className={cn("h-1 rounded-full transition-all duration-300", i === tourStep ? "w-4 bg-primary" : i < tourStep ? "w-1.5 bg-primary/40" : "w-1.5 bg-white/10")} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {isFirst && (
                    <Button variant="ghost" size="sm" onClick={skip} className="h-8 text-xs text-muted-foreground">Skip</Button>
                  )}
                  {!isFirst && (
                    <Button variant="ghost" size="sm" onClick={prev} className="h-8 text-xs gap-1">
                      <ChevronLeft className="h-3 w-3" /> Back
                    </Button>
                  )}
                  {isLast ? (
                    <Button size="sm" onClick={finish} className="h-8 text-xs gap-1.5">
                      Get Started <ArrowRight className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button size="sm" onClick={next} className="h-8 text-xs gap-1">
                      {isFirst ? "Start Tour" : "Next"} <ChevronRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Spotlight tooltip */}
        {!navigating && currentStep.type === "spotlight" && (
          <motion.div
            key={`tooltip-${tourStep}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35 }}
            className="absolute z-[210]"
            style={spotlightRect ? { top: tooltipPos.top, left: tooltipPos.left, width: 340 } : { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 340 }}
          >
            <div
              className="rounded-2xl border border-white/[0.1] bg-black/85 backdrop-blur-2xl p-5 shadow-2xl"
              style={{ boxShadow: "0 0 40px 6px hsl(var(--primary) / 0.06)" }}
            >
              <h3 className="text-sm font-semibold text-foreground mb-2 tracking-tight">{currentStep.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{currentStep.text}</p>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-1">
                  {tourSteps.map((_, i) => (
                    <div key={i} className={cn("h-0.5 rounded-full transition-all duration-300", i === tourStep ? "w-3 bg-primary" : i < tourStep ? "w-1.5 bg-primary/40" : "w-1.5 bg-white/10")} />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={skip} className="h-7 text-[10px] px-2">Skip</Button>
                  {tourStep > 0 && (
                    <Button variant="ghost" size="sm" onClick={prev} className="h-7 text-[10px] gap-0.5 px-2">
                      <ChevronLeft className="h-3 w-3" /> Back
                    </Button>
                  )}
                  {isLast ? (
                    <Button size="sm" onClick={finish} className="h-7 text-[10px] gap-0.5 px-3">
                      Get Started <ArrowRight className="h-3 w-3" />
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
    </AnimatePresence>
  );
}
