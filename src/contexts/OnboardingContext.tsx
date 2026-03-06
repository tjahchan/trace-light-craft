import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingState {
  hasSeenTour: boolean;
  sampleDataEnabled: boolean;
  loading: boolean;
  startTour: () => void;
  completeTour: () => void;
  toggleSampleData: (enabled: boolean) => void;
  clearSampleData: () => void;
  tourActive: boolean;
  tourStep: number;
  setTourStep: (step: number) => void;
  setTourActive: (active: boolean) => void;
}

const OnboardingContext = createContext<OnboardingState>({
  hasSeenTour: true,
  sampleDataEnabled: false,
  loading: true,
  startTour: () => {},
  completeTour: () => {},
  toggleSampleData: () => {},
  clearSampleData: () => {},
  tourActive: false,
  tourStep: 0,
  setTourStep: () => {},
  setTourActive: () => {},
});

export const useOnboarding = () => useContext(OnboardingContext);

// ── Consistent sample data ──
const SAMPLE_TRADES = [
  { symbol: "EUR/USD", side: "Long", entry: 1.0845, exit: 1.0912, pnl: 335.00, qty: 0.5, date: "2026-02-28", session: "London" },
  { symbol: "BTC/USD", side: "Long", entry: 84250, exit: 86100, pnl: 185.00, qty: 0.01, date: "2026-02-27", session: "New York" },
  { symbol: "GBP/USD", side: "Short", entry: 1.2680, exit: 1.2645, pnl: 140.00, qty: 0.4, date: "2026-02-26", session: "London" },
  { symbol: "NZD/USD", side: "Short", entry: 0.5792, exit: 0.5810, pnl: -108.00, qty: 0.6, date: "2026-02-25", session: "Sydney" },
  { symbol: "EUR/USD", side: "Short", entry: 1.0890, exit: 1.0862, pnl: 112.00, qty: 0.4, date: "2026-02-24", session: "London" },
  { symbol: "USD/JPY", side: "Long", entry: 149.85, exit: 150.42, pnl: 228.00, qty: 0.3, date: "2026-02-21", session: "Tokyo" },
  { symbol: "BTC/USD", side: "Short", entry: 87300, exit: 86800, pnl: 50.00, qty: 0.01, date: "2026-02-20", session: "New York" },
  { symbol: "EUR/USD", side: "Long", entry: 1.0810, exit: 1.0785, pnl: -100.00, qty: 0.4, date: "2026-02-19", session: "London" },
  { symbol: "GBP/USD", side: "Long", entry: 1.2610, exit: 1.2668, pnl: 232.00, qty: 0.4, date: "2026-02-18", session: "London" },
  { symbol: "EUR/USD", side: "Short", entry: 1.0870, exit: 1.0842, pnl: 112.00, qty: 0.4, date: "2026-02-14", session: "New York" },
];

export function getSampleData() {
  const totalPnl = SAMPLE_TRADES.reduce((s, t) => s + t.pnl, 0);
  const wins = SAMPLE_TRADES.filter(t => t.pnl > 0);
  const losses = SAMPLE_TRADES.filter(t => t.pnl < 0);
  const winRate = Math.round((wins.length / SAMPLE_TRADES.length) * 100);
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;

  return {
    trades: SAMPLE_TRADES,
    totalPnl,
    balance: 50000 + totalPnl,
    initialBalance: 50000,
    winRate,
    avgWin,
    avgLoss,
    totalTrades: SAMPLE_TRADES.length,
    wins: wins.length,
    losses: losses.length,
    bestTrade: Math.max(...SAMPLE_TRADES.map(t => t.pnl)),
    worstTrade: Math.min(...SAMPLE_TRADES.map(t => t.pnl)),
    profitFactor: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
    streak: { current: 3, best: 7 },
  };
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [hasSeenTour, setHasSeenTour] = useState(true);
  const [sampleDataEnabled, setSampleDataEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("has_seen_tour, sample_data_enabled")
        .eq("user_id", user.id)
        .single();

      if (data) {
        const seen = (data as any).has_seen_tour ?? false;
        const sample = (data as any).sample_data_enabled ?? true;
        setHasSeenTour(seen);
        setSampleDataEnabled(sample);

        // Auto-start tour for new users
        if (!seen) {
          setTimeout(() => setTourActive(true), 1000);
        }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const completeTour = useCallback(async () => {
    setTourActive(false);
    setHasSeenTour(true);
    if (user) {
      await supabase
        .from("profiles")
        .update({ has_seen_tour: true } as any)
        .eq("user_id", user.id);
    }
  }, [user]);

  const startTour = useCallback(() => {
    setTourStep(0);
    setTourActive(true);
  }, []);

  const toggleSampleData = useCallback(async (enabled: boolean) => {
    setSampleDataEnabled(enabled);
    if (user) {
      await supabase
        .from("profiles")
        .update({ sample_data_enabled: enabled } as any)
        .eq("user_id", user.id);
    }
  }, [user]);

  const clearSampleData = useCallback(async () => {
    setSampleDataEnabled(false);
    if (user) {
      await supabase
        .from("profiles")
        .update({ sample_data_enabled: false } as any)
        .eq("user_id", user.id);
    }
  }, [user]);

  return (
    <OnboardingContext.Provider value={{
      hasSeenTour,
      sampleDataEnabled,
      loading,
      startTour,
      completeTour,
      toggleSampleData,
      clearSampleData,
      tourActive,
      tourStep,
      setTourStep,
      setTourActive,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}
