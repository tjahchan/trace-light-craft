import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PlanState {
  plan: "free" | "pro";
  csvImportsUsed: number;
  aiRequestsUsed: number;
  csvLimit: number;
  aiLimit: number;
  loading: boolean;
}

interface PlanContextType extends PlanState {
  isPro: boolean;
  canUseCSV: boolean;
  canUseAI: boolean;
  canUseBrokerSync: boolean;
  canUseJournalInsights: boolean;
  checkAndIncrementUsage: (type: "csv" | "ai") => Promise<{ allowed: boolean; used?: number; limit?: number }>;
  refreshPlan: () => Promise<void>;
  showUpgradeModal: boolean;
  setShowUpgradeModal: (v: boolean) => void;
  upgradeReason: string;
  setUpgradeReason: (r: string) => void;
  triggerUpgrade: (reason: string) => void;
}

const PlanContext = createContext<PlanContextType | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<PlanState>({
    plan: "free",
    csvImportsUsed: 0,
    aiRequestsUsed: 0,
    csvLimit: 3,
    aiLimit: 3,
    loading: true,
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");

  const refreshPlan = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_plans" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const d = data as any;
      // Check if month reset needed client-side for display
      const cycleStart = new Date(d.current_billing_cycle_start);
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const needsReset = monthStart > cycleStart;

      setState({
        plan: d.plan || "free",
        csvImportsUsed: needsReset ? 0 : (d.csv_imports_this_month || 0),
        aiRequestsUsed: needsReset ? 0 : (d.ai_requests_this_month || 0),
        csvLimit: 3,
        aiLimit: 3,
        loading: false,
      });
    } else {
      // Create plan row for existing user
      await supabase.from("user_plans" as any).insert({ user_id: user.id } as any);
      setState(s => ({ ...s, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    refreshPlan();
  }, [refreshPlan]);

  const isPro = state.plan === "pro";
  const canUseCSV = isPro || state.csvImportsUsed < state.csvLimit;
  const canUseAI = isPro || state.aiRequestsUsed < state.aiLimit;
  const canUseBrokerSync = isPro;
  const canUseJournalInsights = isPro;

  const checkAndIncrementUsage = useCallback(async (type: "csv" | "ai") => {
    if (!user) return { allowed: false };
    const { data, error } = await supabase.rpc("increment_usage", {
      p_user_id: user.id,
      p_type: type,
    } as any);

    if (error) return { allowed: false };
    const result = data as any;
    // Refresh local state
    await refreshPlan();
    return { allowed: result.allowed, used: result.used, limit: result.limit };
  }, [user, refreshPlan]);

  const triggerUpgrade = useCallback((reason: string) => {
    setUpgradeReason(reason);
    setShowUpgradeModal(true);
  }, []);

  return (
    <PlanContext.Provider value={{
      ...state,
      isPro,
      canUseCSV,
      canUseAI,
      canUseBrokerSync,
      canUseJournalInsights,
      checkAndIncrementUsage,
      refreshPlan,
      showUpgradeModal,
      setShowUpgradeModal,
      upgradeReason,
      setUpgradeReason,
      triggerUpgrade,
    }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
