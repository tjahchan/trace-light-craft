import { useState } from "react";
import { Image } from "lucide-react";
import { useBackground, backgrounds, BackgroundTheme } from "@/contexts/BackgroundContext";

export function BackgroundSwitcher() {
  const { theme, setTheme } = useBackground();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 backdrop-blur-xl bg-black/60 border border-white/[0.1] rounded-2xl p-3 space-y-2 w-48">
          {(Object.keys(backgrounds) as BackgroundTheme[]).map((key) => (
            <button
              key={key}
              onClick={() => { setTheme(key); setOpen(false); }}
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
              <div>
                <p className="text-xs font-medium">{backgrounds[key].label}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="h-10 w-10 rounded-full backdrop-blur-xl bg-black/40 border border-white/[0.1] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <Image className="h-4 w-4" />
      </button>
    </div>
  );
}
