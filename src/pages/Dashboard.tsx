import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calculateRiskPercent } from "@/lib/trade-utils";
import { motion } from "framer-motion";
import {
  Plus,
  Upload,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Pin,
  Settings2,
  Loader2,
} from "lucide-react";
import { AnimatedFlame } from "@/components/AnimatedFlame";
import { useStreak } from "@/hooks/useStreak";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TradeImportModal } from "@/components/TradeImportModal";
import { CSVImportModal } from "@/components/CSVImportModal";
import { ManageAccountsModal, type Account } from "@/components/ManageAccountsModal";
import { DepositWithdrawModal } from "@/components/DepositWithdrawModal";
import {
  ClosedPositionsFilter,
  hasActiveFilters,
  applyFilters,
  type ClosedPositionFilters,
} from "@/components/ClosedPositionsFilter";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

const emptyFilters: ClosedPositionFilters = {
  dateFrom: undefined,
  dateTo: undefined,
  symbol: "",
  direction: "all",
};

/* ---------- Risk % helper (uses shared util) ---------- */
function getRiskPercent(entry: number, sl: number | null, qty: number, symbol: string, balance: number) {
  return calculateRiskPercent(entry, sl, qty, symbol, balance);
}

function riskColor(pct: number) {
  if (pct <= 1) return "text-profit";
  if (pct <= 2) return "text-amber-400";
  return "text-loss";
}

const STORAGE_KEY = "selectedAccountId";
const ROWS_PER_PAGE = 10;

type BalancePeriod = "week" | "month" | "year";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [balancePeriod, setBalancePeriod] = useState<BalancePeriod>("month");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [filters, setFilters] = useState<ClosedPositionFilters>(emptyFilters);
  const [dbTrades, setDbTrades] = useState<any[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [periodPnl, setPeriodPnl] = useState<Record<string, number>>({ week: 0, month: 0, year: 0 });
  const [chartData, setChartData] = useState<{ date: string; balance: number }[]>([]);
  const [closedPage, setClosedPage] = useState(1);
  const [openPage, setOpenPage] = useState(1);

  const { currentStreak, bestStreak, getWeekDots, loading: streakLoading } = useStreak();
  const streakDays = getWeekDots();

  const selectedAccount = useMemo(() => {
    if (accounts.length === 0) return null;
    return accounts.find((a) => a.id === selectedAccountId) ?? accounts[0];
  }, [accounts, selectedAccountId]);

  const isValidAccount = !!selectedAccount && selectedAccount.id !== "";

  // Persist selectedAccountId to localStorage
  const selectAccount = useCallback((id: string) => {
    setSelectedAccountId(id);
    localStorage.setItem(STORAGE_KEY, id);
    setClosedPage(1);
    setOpenPage(1);
  }, []);

  // ---- Fetch accounts from Supabase ----
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("accounts")
          .select("*")
          .eq("user_id", user.id);

        let accs: Account[] = [];
        if (!error && data && data.length > 0) {
          accs = data.map((a) => ({ id: a.id, name: a.name, balance: Number(a.balance), initialBalance: Number((a as any).initial_balance ?? a.balance ?? 0) }));
        } else if (!error && (!data || data.length === 0)) {
          const { data: newAcc } = await supabase
            .from("accounts")
            .insert({ user_id: user.id, name: "Main Account", balance: 0 })
            .select()
            .single();
          if (newAcc) {
            accs = [{ id: newAcc.id, name: newAcc.name, balance: Number(newAcc.balance), initialBalance: 0 }];
          }
        }

        setAccounts(accs);

        // Restore from localStorage or default to first
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && accs.find((a) => a.id === stored)) {
          setSelectedAccountId(stored);
        } else if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
          localStorage.setItem(STORAGE_KEY, accs[0].id);
        }
        setAccountsLoaded(true);
      } catch (err) {
        console.error("[Dashboard] Error loading accounts:", err);
        setAccountsLoaded(true);
      }
    };
    load();
  }, [user]);

  // ---- Reusable: fetch and set balance (full formula) ----
  const fetchAndSetBalance = useCallback(async (accountId: string) => {
    if (!accountId || !user) return;
    setBalanceLoading(true);
    try {
      // Step 1: Get initial_balance from accounts table
      const { data: accData } = await supabase
        .from("accounts")
        .select("initial_balance, balance")
        .eq("id", accountId)
        .single();
      const initialBalance = accData ? Number((accData as any).initial_balance ?? accData.balance ?? 0) : 0;

      // Step 2: Get SUM of deposits
      const { data: depData } = await supabase
        .from("transactions")
        .select("amount")
        .eq("account_id", accountId)
        .eq("user_id", user.id)
        .eq("type", "deposit");
      const deposits = depData?.reduce((sum, row) => sum + (Number(row.amount) ?? 0), 0) ?? 0;

      // Step 3: Get SUM of withdrawals
      const { data: wdData } = await supabase
        .from("transactions")
        .select("amount")
        .eq("account_id", accountId)
        .eq("user_id", user.id)
        .eq("type", "withdrawal");
      const withdrawals = wdData?.reduce((sum, row) => sum + (Number(row.amount) ?? 0), 0) ?? 0;

      // Step 4: Get SUM of pnl from closed trades
      const { data: pnlData } = await supabase
        .from("trades" as any)
        .select("pnl")
        .eq("account_id", accountId)
        .eq("user_id", user.id)
        .eq("status", "closed");
      const pnl = (pnlData as any[])?.reduce((sum: number, row: any) => sum + (Number(row.pnl) ?? 0), 0) ?? 0;

      // Step 5: Get SUM of commissions from trades
      const { data: commData } = await supabase
        .from("trades" as any)
        .select("commissions")
        .eq("account_id", accountId)
        .eq("user_id", user.id);
      const commissions = (commData as any[])?.reduce((sum: number, row: any) => sum + (Number(row.commissions) ?? 0), 0) ?? 0;

      // Step 6: Calculate balance
      const balance = initialBalance + deposits - withdrawals + pnl - commissions;
      console.log("initial:", initialBalance, "deposits:", deposits, "withdrawals:", withdrawals, "pnl:", pnl, "commissions:", commissions, "final:", balance);

      // Step 7: Write computed balance to accounts table
      await supabase
        .from("accounts")
        .update({ balance } as any)
        .eq("id", accountId);

      // Step 8: Update React state
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, balance } : a))
      );
    } catch (err) {
      console.error("[Dashboard] Error fetching balance:", err);
    } finally {
      setBalanceLoading(false);
    }
  }, [user]);

  // ---- Fetch trades (only when valid account) ----
  const fetchTrades = useCallback(async () => {
    if (!user || !isValidAccount) return;
    try {
      const { data, error } = await supabase
        .from("trades" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("account_id", selectedAccount!.id)
        .eq("status", "closed")
        .order("close_time", { ascending: false });
      if (!error && data) {
        console.log("[Dashboard] Loaded", data.length, "closed trades from DB");
        setDbTrades(data as any[]);
      }
    } catch (err) {
      console.error("[Dashboard] Error fetching trades:", err);
    }
  }, [user, isValidAccount, selectedAccount]);

  // ---- Fetch period PnL from DB ----
  const fetchPeriodPnl = useCallback(async () => {
    if (!user || !isValidAccount) {
      setPeriodPnl({ week: 0, month: 0, year: 0 });
      return;
    }
    try {
      const now = new Date();
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
      const yearAgo = new Date(now); yearAgo.setFullYear(now.getFullYear() - 1);

      const fetchPnlSince = async (since: Date) => {
        const { data } = await supabase
          .from("trades" as any)
          .select("pnl")
          .eq("user_id", user.id)
          .eq("account_id", selectedAccount!.id)
          .eq("status", "closed")
          .gte("close_time", since.toISOString());
        if (!data) return 0;
        return (data as any[]).reduce((sum: number, t: any) => sum + (Number(t.pnl) || 0), 0);
      };

      const [w, m, y] = await Promise.all([
        fetchPnlSince(weekAgo),
        fetchPnlSince(monthAgo),
        fetchPnlSince(yearAgo),
      ]);
      setPeriodPnl({ week: w, month: m, year: y });
    } catch (err) {
      console.error("[Dashboard] Error fetching PnL:", err);
    }
  }, [user, isValidAccount, selectedAccount]);

  // ---- Build chart data from real transactions + trades ----
  const buildChartData = useCallback(async () => {
    if (!user || !isValidAccount) {
      setChartData([]);
      return;
    }
    try {
      const accId = selectedAccount!.id;

      // Get account creation date and initial balance
      const { data: accRow } = await supabase
        .from("accounts")
        .select("initial_balance, balance, created_at")
        .eq("id", accId)
        .single();

      const initialBalance = accRow ? Number((accRow as any).initial_balance ?? accRow.balance ?? 0) : 0;

      // Get all transactions for this account
      const { data: txns } = await supabase
        .from("transactions")
        .select("date, type, amount")
        .eq("account_id", accId)
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      // Get all closed trades for this account
      const { data: trades } = await supabase
        .from("trades" as any)
        .select("close_time, pnl")
        .eq("account_id", accId)
        .eq("user_id", user.id)
        .eq("status", "closed")
        .order("close_time", { ascending: true });

      // Build daily events map
      const events: Record<string, number> = {};
      if (txns) {
        for (const tx of txns) {
          const day = new Date(tx.date).toISOString().split("T")[0];
          const amt = Number(tx.amount) || 0;
          events[day] = (events[day] || 0) + (tx.type === "deposit" ? amt : -amt);
        }
      }
      if (trades) {
        for (const t of trades as any[]) {
          if (!t.close_time) continue;
          const day = new Date(t.close_time).toISOString().split("T")[0];
          events[day] = (events[day] || 0) + (Number(t.pnl) || 0);
        }
      }

      const sortedDays = Object.keys(events).sort();
      if (sortedDays.length === 0) {
        // No history — show flat line at current balance
        const today = new Date().toISOString().split("T")[0];
        setChartData([{ date: today, balance: initialBalance }]);
        return;
      }

      // Build running balance
      let running = initialBalance;
      const points: { date: string; balance: number }[] = [];
      for (const day of sortedDays) {
        running += events[day];
        const d = new Date(day);
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        points.push({ date: label, balance: running });
      }
      setChartData(points);
    } catch (err) {
      console.error("[Dashboard] Error building chart:", err);
    }
  }, [user, isValidAccount, selectedAccount]);

  // ---- Trigger data fetches when account is ready ----
  useEffect(() => {
    if (!accountsLoaded || !isValidAccount) return;
    fetchAndSetBalance(selectedAccount!.id);
    fetchTrades();
    fetchPeriodPnl();
    buildChartData();
  }, [accountsLoaded, isValidAccount, selectedAccount?.id]);

  const refreshAll = useCallback(() => {
    if (!isValidAccount) return;
    fetchAndSetBalance(selectedAccount!.id);
    fetchTrades();
    fetchPeriodPnl();
    buildChartData();
  }, [isValidAccount, selectedAccount, fetchAndSetBalance, fetchTrades, fetchPeriodPnl, buildChartData]);

  // Re-fetch all data when navigating back to dashboard (e.g. after editing a trade)
  useEffect(() => {
    if (location.pathname === "/" && accountsLoaded && isValidAccount) {
      refreshAll();
    }
  }, [location.pathname]);

  // Merge DB trades for closed positions (no more mock data)
  const allClosedPositions = useMemo(() => {
    return dbTrades.map((t: any) => ({
      id: t.id,
      tags: t.tags || [],
      alias: "",
      closedAt: t.close_time ? new Date(t.close_time).toLocaleString() : "",
      symbol: t.symbol,
      side: t.side,
      qty: t.quantity,
      entry: t.entry_price,
      exit: t.exit_price,
      sl: t.sl,
      pnl: t.pnl || 0,
      session: "",
      hasNote: !!t.note,
    }));
  }, [dbTrades]);

  const uniqueSymbols = useMemo(() => [...new Set(allClosedPositions.map((p) => p.symbol))], [allClosedPositions]);
  const filteredPositions = useMemo(() => applyFilters(allClosedPositions, filters), [allClosedPositions, filters]);
  const filtersActive = hasActiveFilters(filters);

  // Pagination for closed positions
  const closedTotalPages = Math.max(1, Math.ceil(filteredPositions.length / ROWS_PER_PAGE));
  const closedPageClamped = Math.min(closedPage, closedTotalPages);
  const paginatedClosed = filteredPositions.slice((closedPageClamped - 1) * ROWS_PER_PAGE, closedPageClamped * ROWS_PER_PAGE);

  const handleFiltersApply = (f: ClosedPositionFilters) => {
    setFilters(f);
    setClosedPage(1);
  };

  const currentPeriodPnl = periodPnl[balancePeriod] || 0;
  const periodLabel = balancePeriod === "week" ? "this week" : balancePeriod === "month" ? "this month" : "this year";
  const isPnlPositive = currentPeriodPnl > 0;
  const isPnlNeutral = currentPeriodPnl === 0;

  const displayBalance = selectedAccount?.balance ?? 0;

  // Use real chart data, or fall back to flat line
  const finalChartData = chartData.length > 0 ? chartData : [{ date: "Today", balance: displayBalance }];

  return (
    <div className="flex gap-6 flex-col xl:flex-row">
      {/* Left Panel */}
      <div className="w-full xl:w-80 shrink-0 space-y-4">
        {/* Streak Tracker Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <AnimatedFlame active={currentStreak >= 1} size={32} />
            <span className="font-semibold text-foreground">
              {streakLoading ? "…" : `${currentStreak} day streak`}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">Best: {bestStreak}</span>
          </div>
          <div className="flex gap-2 justify-between">
            {dayLabels.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{d}</span>
                <div
                  className={`h-3 w-3 rounded-full ${
                    streakDays[i] ? "bg-profit" : "bg-white/[0.08]"
                  } ${
                    i === 5 ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
                  }`}
                />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Combined Account + Actions Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6 space-y-3"
        >
          <div className="flex items-center gap-2">
            {accountsLoaded && accounts.length > 0 ? (
              <Select value={selectedAccountId} onValueChange={selectAccount}>
                <SelectTrigger className="flex-1 bg-white/[0.04] border-white/[0.08]">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name || "Unnamed Account"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Skeleton className="h-9 flex-1" />
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-white/[0.05]" onClick={() => setManageOpen(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 gap-2 text-xs" onClick={() => setImportOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New Trade
            </Button>
            <Button variant="outline" className="flex-1 gap-2 text-xs bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground" onClick={() => setCsvOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> CSV / AI
            </Button>
          </div>
          <Button variant="outline" className="w-full gap-2 text-xs bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground" onClick={() => navigate("/broker-connections")}>
            <RefreshCw className="h-3.5 w-3.5" /> Sync with Broker
          </Button>
        </motion.div>

        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Total Balance</p>
          {!accountsLoaded || balanceLoading ? (
            <Skeleton className="h-9 w-40 mb-2" />
          ) : (
            <p className="text-3xl font-mono font-medium text-foreground">
              ${displayBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {isPnlNeutral ? (
              <>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-mono text-muted-foreground">+$0.00 {periodLabel}</span>
              </>
            ) : isPnlPositive ? (
              <>
                <ArrowUpRight className="h-3.5 w-3.5 text-profit" />
                <span className="text-sm font-mono text-profit">+${currentPeriodPnl.toFixed(2)} {periodLabel}</span>
              </>
            ) : (
              <>
                <ArrowDownRight className="h-3.5 w-3.5 text-loss" />
                <span className="text-sm font-mono text-loss">-${Math.abs(currentPeriodPnl).toFixed(2)} {periodLabel}</span>
              </>
            )}
          </div>

          {/* Period Toggle */}
          <div className="flex rounded-lg bg-white/[0.05] p-0.5 mt-3">
            {(["week", "month", "year"] as BalancePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setBalancePeriod(p)}
                className={cn(
                  "flex-1 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                  balancePeriod === p ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="mt-3 h-28">
            {accountsLoaded && isValidAccount ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={finalChartData}>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    hide={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                    width={40}
                    domain={["dataMin - 200", "dataMax + 200"]}
                  />
                  <Line type="monotone" dataKey="balance" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.8)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#fff",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Balance"]}
                    labelFormatter={(label: string) => label}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground text-xs"
            onClick={() => setDepositOpen(true)}
          >
            Deposit / Withdraw
          </Button>
        </motion.div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Open Positions Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Open Orders & Positions</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-8 text-center text-muted-foreground text-sm">No orders to display. Create your first order.</div>
        </motion.div>

        {/* Closed Positions Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Closed Positions</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground relative" onClick={() => setFilterOpen(!filterOpen)}>
              <Filter className="h-3.5 w-3.5" />
              {filtersActive && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
            </Button>
          </div>

          <ClosedPositionsFilter open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onApply={setFilters} symbols={uniqueSymbols} />

          {!accountsLoaded ? (
            <div className="p-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="p-3 text-left font-medium"><Pin className="h-3 w-3" /></th>
                    <th className="p-3 text-left font-medium">Tags</th>
                    <th className="p-3 text-left font-medium">Alias</th>
                    <th className="p-3 text-left font-medium">Closed At</th>
                    <th className="p-3 text-left font-medium">Symbol</th>
                    <th className="p-3 text-left font-medium">Side</th>
                    <th className="p-3 text-right font-medium">Qty</th>
                    <th className="p-3 text-right font-medium">Entry</th>
                    <th className="p-3 text-right font-medium">Exit</th>
                    <th className="p-3 text-right font-medium">Risk %</th>
                    <th className="p-3 text-right font-medium">PnL</th>
                    <th className="p-3 text-left font-medium">Session</th>
                    <th className="p-3 text-center font-medium">📓</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPositions.map((pos) => {
                    const risk = getRiskPercent(pos.entry, pos.sl, pos.qty, pos.symbol, displayBalance);
                    return (
                      <tr key={pos.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => navigate(`/trade/${pos.id}`)}>
                        <td className="p-3"><Pin className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" /></td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {pos.tags.map((t: string) => (
                              <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-muted-foreground">{t}</span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-foreground">{pos.alias || "—"}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{pos.closedAt}</td>
                        <td className="p-3 font-mono font-medium text-foreground">{pos.symbol}</td>
                        <td className="p-3">
                          <span className={pos.side === "Long" ? "badge-long" : "badge-short"}>{pos.side}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-foreground">{pos.qty}</td>
                        <td className="p-3 text-right font-mono text-foreground">{pos.entry}</td>
                        <td className="p-3 text-right font-mono text-foreground">{pos.exit}</td>
                        <td className="p-3 text-right font-mono">
                          {risk !== null ? (
                            <span className={riskColor(risk)}>{risk.toFixed(1)}%</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={`p-3 text-right font-mono font-medium ${pos.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                          {pos.pnl >= 0 ? "+" : ""}${Math.abs(pos.pnl).toFixed(2)}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{pos.session}</td>
                        <td className="p-3 text-center">
                          {pos.hasNote && <span className="cursor-pointer hover:opacity-80" title="View linked journal entry">📓</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPositions.length === 0 && (
                    <tr>
                      <td colSpan={13} className="p-6 text-center text-muted-foreground text-sm">No closed positions yet. Import trades to get started.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      <TradeImportModal open={importOpen} onOpenChange={setImportOpen} />
      <CSVImportModal open={csvOpen} onOpenChange={setCsvOpen} accountId={selectedAccountId} onImportComplete={refreshAll} />
      <ManageAccountsModal open={manageOpen} onOpenChange={setManageOpen} accounts={accounts} onAccountsChange={setAccounts} userId={user?.id || ""} onBalanceRefresh={fetchAndSetBalance} />
      <DepositWithdrawModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        accountId={selectedAccountId}
        userId={user?.id || ""}
        onTransactionComplete={refreshAll}
      />
    </div>
  );
}
