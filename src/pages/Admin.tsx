import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/contexts/PlanContext";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Users, Crown, DollarSign, Activity, BarChart3, Bot,
  Link2, Search, Filter, ChevronLeft, ArrowUpRight,
  RotateCcw, Shield, X, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminUser {
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
  last_active_at: string;
  plan: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  current_streak: number;
  best_streak: number;
  ai_requests_this_month: number;
  csv_imports_this_month: number;
  sample_data_enabled: boolean;
  has_seen_tour: boolean;
}

interface AdminStats {
  total_users: number;
  free_users: number;
  pro_users: number;
  active_users_30d: number;
  total_trades: number;
  total_ai_requests: number;
  broker_connected_users: number;
}

export default function Admin() {
  const { isAdmin } = usePlan();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [referralStats, setReferralStats] = useState<{ user_id: string; display_name: string; referral_count: number }[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    const [usersRes, statsRes] = await Promise.all([
      supabase.rpc("admin_get_users" as any),
      supabase.rpc("admin_get_stats" as any),
    ]);
    if (usersRes.data) setUsers(usersRes.data as any);
    if (statsRes.data) setStats(statsRes.data as any);
    setLoading(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = !search ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.display_name?.toLowerCase().includes(search.toLowerCase());
      const matchPlan = planFilter === "all" || u.plan === planFilter;
      return matchSearch && matchPlan;
    });
  }, [users, search, planFilter]);

  const handleAdminAction = async (userId: string, action: string) => {
    setActionLoading(true);
    try {
      if (action === "set_pro") {
        await supabase.rpc("admin_update_user_plan" as any, { p_target_user_id: userId, p_plan: "pro" });
      } else if (action === "set_free") {
        await supabase.rpc("admin_update_user_plan" as any, { p_target_user_id: userId, p_plan: "free" });
      } else if (action === "reset_ai") {
        await supabase.rpc("admin_update_user_plan" as any, { p_target_user_id: userId, p_reset_ai: true });
      } else if (action === "reset_csv") {
        await supabase.rpc("admin_update_user_plan" as any, { p_target_user_id: userId, p_reset_csv: true });
      }
      await loadData();
      // Refresh selected user
      if (selectedUser?.user_id === userId) {
        const updated = users.find(u => u.user_id === userId);
        if (updated) setSelectedUser(updated);
      }
    } catch (e) {
      console.error("Admin action error:", e);
    }
    setActionLoading(false);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">You don't have admin permissions.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const mrr = (stats?.pro_users ?? 0) * 14;

  // Fetch referral stats
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("profiles")
      .select("user_id, display_name, email, referral_count")
      .gt("referral_count", 0)
      .order("referral_count", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setReferralStats(data.map((d: any) => ({
            user_id: d.user_id,
            display_name: d.display_name || d.email?.split("@")[0] || "—",
            referral_count: d.referral_count || 0,
          })));
        }
      });
  }, [isAdmin]);

  const statCards = [
    { label: "Total Users", value: stats?.total_users ?? 0, icon: Users },
    { label: "Free Users", value: stats?.free_users ?? 0, icon: Users },
    { label: "Pro Users", value: stats?.pro_users ?? 0, icon: Crown },
    { label: "MRR", value: `$${mrr}`, icon: DollarSign },
    { label: "Active (30d)", value: stats?.active_users_30d ?? 0, icon: Activity },
    { label: "Broker Connected", value: stats?.broker_connected_users ?? 0, icon: Link2 },
    { label: "Total Trades", value: stats?.total_trades ?? 0, icon: BarChart3 },
    { label: "AI Requests", value: stats?.total_ai_requests ?? 0, icon: Bot },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
        <Button variant="ghost" size="sm" onClick={loadData} className="text-muted-foreground gap-2">
          <RotateCcw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
            </div>
            <p className="text-xl font-mono font-medium text-foreground">{value}</p>
          </motion.div>
        ))}
      </div>

      {/* User Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by email or name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-white/[0.04] border-white/[0.08] text-sm"
            />
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-32 bg-white/[0.04] border-white/[0.08] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-muted-foreground text-xs uppercase tracking-wider">
                <th className="p-2 text-left font-medium">User</th>
                <th className="p-2 text-left font-medium">Plan</th>
                <th className="p-2 text-left font-medium">Status</th>
                <th className="p-2 text-right font-medium">Streak</th>
                <th className="p-2 text-right font-medium">AI Used</th>
                <th className="p-2 text-right font-medium">CSV Used</th>
                <th className="p-2 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr
                  key={u.user_id}
                  onClick={() => setSelectedUser(u)}
                  className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  <td className="p-2">
                    <div>
                      <p className="text-foreground text-sm font-medium truncate max-w-[200px]">{u.display_name || "—"}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{u.email}</p>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-semibold uppercase",
                      u.plan === "pro" ? "bg-primary/20 text-primary" : "bg-white/[0.06] text-muted-foreground"
                    )}>{u.plan}</span>
                  </td>
                  <td className="p-2">
                    <span className={cn(
                      "text-xs",
                      u.subscription_status === "active" ? "text-profit" :
                      u.subscription_status === "past_due" ? "text-amber-400" : "text-muted-foreground"
                    )}>{u.subscription_status}</span>
                  </td>
                  <td className="p-2 text-right font-mono text-foreground">{u.current_streak}</td>
                  <td className="p-2 text-right font-mono text-muted-foreground">{u.ai_requests_this_month}</td>
                  <td className="p-2 text-right font-mono text-muted-foreground">{u.csv_imports_this_month}</td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Referral Tracking */}
      {referralStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5"
        >
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Top Referrers</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-muted-foreground text-xs uppercase tracking-wider">
                <th className="p-2 text-left font-medium">User</th>
                <th className="p-2 text-right font-medium">Referrals</th>
              </tr>
            </thead>
            <tbody>
              {referralStats.map((r) => (
                <tr key={r.user_id} className="border-b border-white/[0.04]">
                  <td className="p-2 text-foreground font-mono text-xs">{r.display_name}</td>
                  <td className="p-2 text-right font-mono text-foreground">{r.referral_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* User Detail Panel */}
      {selectedUser && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">User Details</h2>
            <button onClick={() => setSelectedUser(null)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            {[
              ["Name", selectedUser.display_name || "—"],
              ["Email", selectedUser.email],
              ["Plan", selectedUser.plan],
              ["Subscription", selectedUser.subscription_status],
              ["Stripe ID", selectedUser.stripe_customer_id || "—"],
              ["Streak", `${selectedUser.current_streak} (Best: ${selectedUser.best_streak})`],
              ["AI Used", `${selectedUser.ai_requests_this_month}/mo`],
              ["CSV Used", `${selectedUser.csv_imports_this_month}/mo`],
              ["Tour Seen", selectedUser.has_seen_tour ? "Yes" : "No"],
              ["Sample Data", selectedUser.sample_data_enabled ? "On" : "Off"],
              ["Joined", new Date(selectedUser.created_at).toLocaleDateString()],
              ["Last Active", selectedUser.last_active_at ? new Date(selectedUser.last_active_at).toLocaleDateString() : "—"],
            ].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</p>
                <p className="text-foreground font-mono text-xs truncate">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading || selectedUser.plan === "pro"}
              onClick={() => handleAdminAction(selectedUser.user_id, "set_pro")}
              className="text-xs bg-white/[0.04] border-white/[0.08] text-foreground gap-1"
            >
              <Crown className="h-3 w-3" /> Set Pro
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading || selectedUser.plan === "free"}
              onClick={() => handleAdminAction(selectedUser.user_id, "set_free")}
              className="text-xs bg-white/[0.04] border-white/[0.08] text-foreground gap-1"
            >
              <ChevronLeft className="h-3 w-3" /> Set Free
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading}
              onClick={() => handleAdminAction(selectedUser.user_id, "reset_ai")}
              className="text-xs bg-white/[0.04] border-white/[0.08] text-foreground gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset AI
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading}
              onClick={() => handleAdminAction(selectedUser.user_id, "reset_csv")}
              className="text-xs bg-white/[0.04] border-white/[0.08] text-foreground gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset CSV
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
