import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BackgroundTheme = "forest" | "beach" | "mountains" | "nightcity" | "minimal" | "custom";

interface BackgroundContextType {
  theme: BackgroundTheme;
  setTheme: (theme: BackgroundTheme) => void;
  calendarOpacity: number;
  setCalendarOpacity: (opacity: number) => void;
  customBackgroundUrl: string | null;
  setCustomBackgroundUrl: (url: string | null) => void;
}

const BackgroundContext = createContext<BackgroundContextType>({
  theme: "forest",
  setTheme: () => {},
  calendarOpacity: 100,
  setCalendarOpacity: () => {},
  customBackgroundUrl: null,
  setCustomBackgroundUrl: () => {},
});

export const backgrounds: Record<Exclude<BackgroundTheme, "custom">, { label: string; image: string | null; desc: string }> = {
  forest: { label: "Forest", image: "/backgrounds/forest.jpg", desc: "Dark green cinematic" },
  beach: { label: "Ocean", image: "/backgrounds/ocean.jpg", desc: "Deep underwater rays" },
  mountains: { label: "Mountains", image: "/backgrounds/mountains.jpg", desc: "Starlit snow peaks" },
  nightcity: { label: "Night City", image: "/backgrounds/nightcity.jpg", desc: "City skyline glow" },
  minimal: { label: "Minimal", image: null, desc: "Pure dark" },
};

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<BackgroundTheme>(() => {
    return (localStorage.getItem("bg-theme") as BackgroundTheme) || "forest";
  });

  const [calendarOpacity, setCalendarOpacity] = useState<number>(() => {
    const stored = localStorage.getItem("calendar-opacity");
    return stored ? Number(stored) : 100;
  });

  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string | null>(() => {
    return localStorage.getItem("custom-bg-url");
  });

  const setTheme = (t: BackgroundTheme) => {
    setThemeState(t);
  };

  useEffect(() => {
    localStorage.setItem("bg-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("calendar-opacity", String(calendarOpacity));
  }, [calendarOpacity]);

  useEffect(() => {
    if (customBackgroundUrl) {
      localStorage.setItem("custom-bg-url", customBackgroundUrl);
    } else {
      localStorage.removeItem("custom-bg-url");
    }
  }, [customBackgroundUrl]);

  return (
    <BackgroundContext.Provider value={{ theme, setTheme, calendarOpacity, setCalendarOpacity, customBackgroundUrl, setCustomBackgroundUrl }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export const useBackground = () => useContext(BackgroundContext);
