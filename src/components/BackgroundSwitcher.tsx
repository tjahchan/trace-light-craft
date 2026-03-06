import { useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBackground, backgrounds, BackgroundTheme } from "@/contexts/BackgroundContext";

interface BackgroundSwitcherProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export function BackgroundSwitcher({ externalOpen, onExternalClose }: BackgroundSwitcherProps) {
  const { theme, setTheme } = useBackground();

  // Close on escape
  useEffect(() => {
    if (!externalOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onExternalClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [externalOpen, onExternalClose]);

  return (
    <AnimatePresence>
      {externalOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          className="fixed bottom-16 left-4 z-[300] backdrop-blur-xl bg-black/70 border border-white/[0.1] rounded-2xl p-4 space-y-2 w-52"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Backgrounds</span>
            <button onClick={onExternalClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {(Object.keys(backgrounds) as BackgroundTheme[]).map((key) => (
            <button
              key={key}
              onClick={() => { setTheme(key); onExternalClose?.(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm transition-all ${
                theme === key
                  ? "bg-white/[0.1] text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
              }`}
            >
              {backgrounds[key].image ? (
                <div
                  className="h-6 w-6 rounded-md bg-cover bg-center shrink-0"
                  style={{ backgroundImage: `url(${backgrounds[key].image})` }}
                />
              ) : (
                <div className="h-6 w-6 rounded-md bg-background border border-white/[0.1] shrink-0" />
              )}
              <p className="text-xs font-medium">{backgrounds[key].label}</p>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
