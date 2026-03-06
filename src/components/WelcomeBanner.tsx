import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Eye, EyeOff, Trash2, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useState } from "react";

export function WelcomeBanner() {
  const { hasSeenTour, sampleDataEnabled, toggleSampleData, clearSampleData, startTour, loading } = useOnboarding();
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed) return null;
  // Show banner only if user hasn't completed tour OR has sample data enabled
  if (hasSeenTour && !sampleDataEnabled) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="relative backdrop-blur-xl bg-primary/[0.04] border border-primary/20 rounded-2xl p-4 mb-4"
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground mb-0.5">
              {!hasSeenTour ? "Welcome to Momentra" : "Sample Data Active"}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {!hasSeenTour
                ? "Take a quick tour to discover how Momentra helps you become a better trader."
                : "You're viewing sample data. Toggle it off to see your real account, or clear it permanently."}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {!hasSeenTour && (
                <Button size="sm" onClick={startTour} className="h-7 text-xs gap-1.5">
                  <BookOpen className="h-3 w-3" /> Take the Tour
                </Button>
              )}
              {sampleDataEnabled ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSampleData(false)}
                    className="h-7 text-xs gap-1.5 bg-white/[0.04] border-white/[0.08]"
                  >
                    <EyeOff className="h-3 w-3" /> Hide Sample Data
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSampleData}
                    className="h-7 text-xs gap-1.5 bg-white/[0.04] border-white/[0.08] text-loss hover:text-loss"
                  >
                    <Trash2 className="h-3 w-3" /> Clear Sample Data
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSampleData(true)}
                  className="h-7 text-xs gap-1.5 bg-white/[0.04] border-white/[0.08]"
                >
                  <Eye className="h-3 w-3" /> Show Sample Data
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
