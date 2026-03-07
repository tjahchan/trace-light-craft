import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type BackgroundTheme = "forest" | "beach" | "mountains" | "nightcity" | "minimal";

interface BackgroundContextType {
  theme: BackgroundTheme;
  setTheme: (theme: BackgroundTheme) => void;
  calendarOpacity: number;
  setCalendarOpacity: (opacity: number) => void;
}

const BackgroundContext = createContext<BackgroundContextType>({
  theme: "forest",
  setTheme: () => {},
  calendarOpacity: 100,
  setCalendarOpacity: () => {},
});

export const backgrounds: Record<BackgroundTheme, { label: string; image: string | null; desc: string }> = {
  forest: { label: "Forest", image: "/backgrounds/forest.jpg", desc: "Dark green cinematic" },
  beach: { label: "Ocean", image: "/backgrounds/ocean.jpg", desc: "Deep underwater rays" },
  mountains: { label: "Mountains", image: "/backgrounds/mountains.jpg", desc: "Starlit snow peaks" },
  nightcity: { label: "Night City", image: "/backgrounds/nightcity.jpg", desc: "City skyline glow" },
  minimal: { label: "Minimal", image: null, desc: "Pure dark" },
};

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<BackgroundTheme>(() => {
    return (localStorage.getItem("bg-theme") as BackgroundTheme) || "forest";
  });

  const [calendarOpacity, setCalendarOpacity] = useState<number>(() => {
    const stored = localStorage.getItem("calendar-opacity");
    return stored ? Number(stored) : 100;
  });

  useEffect(() => {
    localStorage.setItem("bg-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("calendar-opacity", String(calendarOpacity));
  }, [calendarOpacity]);

  return (
    <BackgroundContext.Provider value={{ theme, setTheme, calendarOpacity, setCalendarOpacity }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export const useBackground = () => useContext(BackgroundContext);
