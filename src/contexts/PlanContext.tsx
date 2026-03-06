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
  subscriptionStatus: string;
  subscriptionEnd: string | null;
  stripeCustomerId: string | null;
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
  startCheckout: () => Promise<void>;
  openBillingPortal: () => Promise<void>;
  isAdmin: boolean;
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
    subscriptionStatus: "none",
    subscriptionEnd: null,
    stripeCustomerId: null,
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (!error && data) {
        // Plan state will be updated via refreshPlan which reads from DB
      }
    } catch (e) {
      console.error("Error checking subscription:", e);
    }
  }, [user]);

  const refreshPlan = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_plans" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const d = data as any;
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
        subscriptionStatus: d.subscription_status || "none",
        subscriptionEnd: d.billing_cycle_end || null,
        stripeCustomerId: d.stripe_customer_id || null,
      });
    } else {
      await supabase.from("user_plans" as any).insert({ user_id: user.id } as any);
      setState(s => ({ ...s, loading: false }));
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!roleData);
  }, [user]);

  useEffect(() => {
    if (user) {
      checkSubscription().then(() => refreshPlan());
    }
  }, [user, checkSubscription, refreshPlan]);

  // Periodic subscription check every 60s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      checkSubscription().then(() => refreshPlan());
    }, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription, refreshPlan]);

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
    await refreshPlan();
    return { allowed: result.allowed, used: result.used, limit: result.limit };
  }, [user, refreshPlan]);

  const triggerUpgrade = useCallback((reason: string) => {
    setUpgradeReason(reason);
    setShowUpgradeModal(true);
  }, []);

  const startCheckout = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e) {
      console.error("Checkout error:", e);
    }
  }, []);

  const openBillingPortal = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e) {
      console.error("Portal error:", e);
    }
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
      startCheckout,
      openBillingPortal,
      isAdmin,
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
