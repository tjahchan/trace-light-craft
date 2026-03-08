import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calculatePnl, calculateRiskPercent } from "@/lib/trade-utils";
import { useLivePrices } from "@/hooks/useLivePrices";
import { useAccountLedger, type BalancePeriod } from "@/hooks/useAccountLedger";
import { motion } from "framer-motion";
import {
  Plus, Upload, RefreshCw, ArrowUpRight, ArrowDownRight, Filter, Pin, Settings2, Loader2,
} from "lucide-react";
import { AnimatedFlame } from "@/components/AnimatedFlame";
import { useStreak } from "@/hooks/useStreak";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { TradeImportModal } from "@/components/TradeImportModal";
import { CSVImportModal } from "@/components/CSVImportModal";
import { ManageAccountsModal, type Account } from "@/components/ManageAccountsModal";
import { DepositWithdrawModal } from "@/components/DepositWithdrawModal";
import {
  ClosedPositionsFilter, hasActiveFilters, applyFilters, type ClosedPositionFilters,
} from "@/components/ClosedPositionsFilter";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { ChevronLeft, ChevronRight } from "lucide-react";

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

const emptyFilters: ClosedPositionFilters = {
  dateFrom: undefined, dateTo: undefined, symbol: "", direction: "all",
};

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

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [balancePeriod, setBalancePeriod] = useState<BalancePeriod>(() =>
    (localStorage.getItem("balancePeriod") as BalancePeriod) || "month"
  );

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [filters, setFilters] = useState<ClosedPositionFilters>(emptyFilters);
  const [dbTrades, setDbTrades] = useState<any[]>([]);
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [closedPage, setClosedPage] = useState(1);
  const [openPage, setOpenPage] = useState(1);
  const [pnlDisplayMode, setPnlDisplayMode] = useState<"$" | "%">(() =>
    (localStorage.getItem("pnlDisplayMode") as "$" | "%") || "$"
  );

  const { currentStreak, bestStreak, getWeekDots, loading: streakLoading } = useStreak();
  const streakDays = getWeekDots();

  const selectedAccount = useMemo(() => {
    if (accounts.length === 0) return null;
    return accounts.find((a) => a.id === selectedAccountId) ?? accounts[0];
  }, [accounts, selectedAccountId]);

  const isValidAccount = !!selectedAccount && selectedAccount.id !== "";

  // ─── UNIFIED LEDGER (single source of truth) ───
  const {
    breakdown,
    periodPnl,
    loading: ledgerLoading,
    reconcile,
    getBalanceSeries,
  } = useAccountLedger(user?.id, selectedAccount?.id);

  // Chart data derived from ledger
  const chartData = useMemo(
    () => getBalanceSeries(balancePeriod),
    [getBalanceSeries, balancePeriod]
  );

  // Balance & PnL from ledger breakdown
  const displayBalance = breakdown.currentBalance;
  const currentPeriodPnl = periodPnl[balancePeriod] || 0;

  const selectAccount = useCallback((id: string) => {
    setSelectedAccountId(id);
    localStorage.setItem(STORAGE_KEY, id);
    setClosedPage(1);
    setOpenPage(1);
  }, []);

  // ── Fetch accounts ──
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data, error } = await supabase.from("accounts").select("*").eq("user_id", user.id);
        let accs: Account[] = [];
        if (!error && data && data.length > 0) {
          accs = data.map((a) => ({ id: a.id, name: a.name, balance: Number(a.balance), initialBalance: Number(a.initial_balance ?? 0) }));
        } else if (!error && (!data || data.length === 0)) {
          const { data: newAcc } = await supabase.from("accounts").insert({ user_id: user.id, name: "Main Account", balance: 0 }).select().single();
          if (newAcc) accs = [{ id: newAcc.id, name: newAcc.name, balance: Number(newAcc.balance), initialBalance: 0 }];
        }
        setAccounts(accs);
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

  // ── Fetch trades ──
  const fetchTrades = useCallback(async () => {
    if (!user || !isValidAccount) return;
    const { data } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .eq("account_id", selectedAccount!.id)
      .eq("status", "closed")
      .order("close_time", { ascending: false });
    if (data) setDbTrades(data as any[]);
  }, [user, isValidAccount, selectedAccount]);

  const fetchOpenTrades = useCallback(async () => {
    if (!user || !isValidAccount) return;
    const { data } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .eq("account_id", selectedAccount!.id)
      .eq("status", "open")
      .order("open_time", { ascending: false });
    if (data) setOpenTrades(data as any[]);
  }, [user, isValidAccount, selectedAccount]);

  // ── Trigger fetches when account ready ──
  useEffect(() => {
    if (!accountsLoaded || !isValidAccount) return;
    fetchTrades();
    fetchOpenTrades();
  }, [accountsLoaded, isValidAccount, selectedAccount?.id]);

  const refreshAll = useCallback(() => {
    if (!isValidAccount) return;
    reconcile();
    fetchTrades();
    fetchOpenTrades();
  }, [isValidAccount, reconcile, fetchTrades, fetchOpenTrades]);

  // Re-fetch on navigation back
  useEffect(() => {
    if (location.pathname === "/" && accountsLoaded && isValidAccount) refreshAll();
  }, [location.pathname]);

  // ── Derived data ──
  const allClosedPositions = useMemo(() =>
    dbTrades.map((t: any) => ({
      id: t.id, tags: t.tags || [], alias: "",
      closedAt: t.close_time ? new Date(t.close_time).toLocaleString() : "",
      symbol: t.symbol, side: t.side, qty: t.quantity,
      entry: t.entry_price, exit: t.exit_price, sl: t.sl,
      pnl: t.pnl || 0, session: "", hasNote: !!t.note,
    })),
  [dbTrades]);

  const openPositions = useMemo(() =>
    openTrades.map((t: any) => ({
      id: t.id, symbol: t.symbol, side: t.side, qty: t.quantity,
      entry: t.entry_price, sl: t.sl, tp: t.tp,
      openedAt: t.open_time ? new Date(t.open_time).toLocaleString() : "",
      tags: t.tags || [],
    })),
  [openTrades]);

  const openSymbols = useMemo(() => openPositions.map(p => p.symbol), [openPositions]);
  const livePrices = useLivePrices(openSymbols);
  const hasOpenTrades = openPositions.length > 0;

  const openTotalPages = Math.max(1, Math.ceil(openPositions.length / ROWS_PER_PAGE));
  const openPageClamped = Math.min(openPage, openTotalPages);
  const paginatedOpen = openPositions.slice((openPageClamped - 1) * ROWS_PER_PAGE, openPageClamped * ROWS_PER_PAGE);

  const uniqueSymbols = useMemo(() => [...new Set(allClosedPositions.map((p) => p.symbol))], [allClosedPositions]);
  const filteredPositions = useMemo(() => applyFilters(allClosedPositions, filters), [allClosedPositions, filters]);
  const filtersActive = hasActiveFilters(filters);

  const closedTotalPages = Math.max(1, Math.ceil(filteredPositions.length / ROWS_PER_PAGE));
  const closedPageClamped = Math.min(closedPage, closedTotalPages);
  const paginatedClosed = filteredPositions.slice((closedPageClamped - 1) * ROWS_PER_PAGE, closedPageClamped * ROWS_PER_PAGE);

  const handleFiltersApply = (f: ClosedPositionFilters) => { setFilters(f); setClosedPage(1); };

  const periodMap: Record<BalancePeriod, string> = { day: "today", week: "this week", month: "this month", year: "this year" };
  const periodLabel = periodMap[balancePeriod];
  const isPnlPositive = currentPeriodPnl > 0;
  const isPnlNeutral = currentPeriodPnl === 0;

  const balanceAtStartOfPeriod = displayBalance - currentPeriodPnl;
  const periodPctChange = balanceAtStartOfPeriod !== 0
    ? (currentPeriodPnl / Math.abs(balanceAtStartOfPeriod)) * 100
    : 0;

  const togglePnlMode = (mode: "$" | "%") => { setPnlDisplayMode(mode); localStorage.setItem("pnlDisplayMode", mode); };

  const pnlDisplayText = pnlDisplayMode === "$"
    ? `${isPnlPositive ? "+" : isPnlNeutral ? "+" : "-"}$${Math.abs(currentPeriodPnl).toFixed(2)}`
    : `${isPnlPositive ? "+" : isPnlNeutral ? "+" : "-"}${Math.abs(periodPctChange).toFixed(2)}%`;

  const finalChartData = chartData.length > 0 ? chartData : [{ date: "Today", balance: displayBalance }];

  return (
    <div className="space-y-0">
      <WelcomeBanner />
      <div className="flex gap-4 sm:gap-6 flex-col xl:flex-row">
      {/* Left Panel */}
      <div className="w-full xl:w-80 shrink-0 space-y-4">
        {/* Streak Tracker Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-4"
          data-tour="streak-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <AnimatedFlame active={currentStreak >= 1} size={24} />
            <span className="font-semibold text-foreground text-sm">
              {streakLoading ? "…" : `${currentStreak} day streak`}
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">Best: {bestStreak}</span>
          </div>
          <div className="flex gap-2 justify-between">
            {dayLabels.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-muted-foreground">{d}</span>
                <div className={`h-2.5 w-2.5 rounded-full ${streakDays[i] ? "bg-profit" : "bg-white/[0.08]"} ${i === 5 ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Combined Account + Actions Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-4 space-y-2"
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
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-4"
          data-tour="balance-card"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Total Balance</p>
          {!accountsLoaded || ledgerLoading ? (
            <Skeleton className="h-9 w-40 mb-2" />
          ) : (
            <p className="text-2xl font-mono font-medium text-foreground">
              ${displayBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {isPnlNeutral ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : isPnlPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-profit" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-loss" />
            )}
            <span className={cn("text-sm font-mono", isPnlNeutral ? "text-muted-foreground" : isPnlPositive ? "text-profit" : "text-loss")}>
              {pnlDisplayText} {periodLabel}
            </span>
            <div className="flex rounded-md bg-white/[0.06] p-0.5 ml-auto">
              {(["$", "%"] as const).map((mode) => (
                <button key={mode} onClick={() => togglePnlMode(mode)}
                  className={cn("px-2 py-0.5 rounded text-[10px] font-medium transition-colors", pnlDisplayMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >{mode}</button>
              ))}
            </div>
          </div>

          {/* Period Toggle */}
          <div className="flex rounded-lg bg-white/[0.05] p-0.5 mt-3">
            {(["day", "week", "month", "year"] as BalancePeriod[]).map((p) => {
              const labels: Record<BalancePeriod, string> = { day: "D", week: "W", month: "M", year: "Y" };
              return (
                <button key={p} onClick={() => { setBalancePeriod(p); localStorage.setItem("balancePeriod", p); }}
                  className={cn("flex-1 py-1 rounded-md text-xs font-medium transition-colors", balancePeriod === p ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground")}
                >{labels[p]}</button>
              );
            })}
          </div>

          <div className="mt-2 h-24">
            {accountsLoaded && isValidAccount ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={finalChartData}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis hide={false} axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                    width={40} domain={["dataMin - 200", "dataMax + 200"]} />
                  <Line type="monotone" dataKey="balance" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload[0]) return null;
                      const point = payload[0].payload;
                      return (
                        <div style={{ background: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px", fontFamily: "monospace", fontSize: "11px", color: "#fff", maxWidth: "220px" }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                          <div style={{ color: "hsl(217, 91%, 60%)" }}>Balance: ${point.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                          {point.trades?.length > 0 && (
                            <div style={{ marginTop: 6, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 4 }}>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>Trades:</div>
                              {point.trades.map((t: any, i: number) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <span>{t.symbol}</span>
                                  <span style={{ color: t.pnl >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)" }}>
                                    {t.pnl >= 0 ? "+" : ""}${Math.abs(t.pnl).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" className="w-full mt-3 bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground text-xs" onClick={() => setDepositOpen(true)}>
            Deposit / Withdraw
          </Button>
        </motion.div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Open Positions Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Open Orders & Positions</h2>
              {hasOpenTrades && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-profit/20 text-profit border border-profit/30 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse" /> LIVE
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><Filter className="h-3.5 w-3.5" /></Button>
          </div>
          {openPositions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No open positions. Click "New Trade" and select "Open Position" to track a live trade.</div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="p-3 text-left font-medium">Symbol</th>
                      <th className="p-3 text-left font-medium">Side</th>
                      <th className="p-3 text-right font-medium">Qty</th>
                      <th className="p-3 text-right font-medium">Entry</th>
                      <th className="p-3 text-right font-medium">Current Price</th>
                      <th className="p-3 text-right font-medium">Live PnL</th>
                      <th className="p-3 text-left font-medium">Opened At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOpen.map((pos) => {
                      const currentPrice = livePrices[pos.symbol] ?? null;
                      const livePnl = currentPrice ? calculatePnl(pos.entry, currentPrice, pos.qty, pos.side, pos.symbol) : null;
                      return (
                        <tr key={pos.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => navigate(`/trade/${pos.id}`)}>
                          <td className="p-3 font-mono font-medium text-foreground">{pos.symbol}</td>
                          <td className="p-3"><span className={pos.side === "Long" ? "badge-long" : "badge-short"}>{pos.side}</span></td>
                          <td className="p-3 text-right font-mono text-foreground">{pos.qty}</td>
                          <td className="p-3 text-right font-mono text-foreground">{pos.entry}</td>
                          <td className="p-3 text-right font-mono text-muted-foreground">
                            {currentPrice !== null ? currentPrice.toFixed(currentPrice < 10 ? 5 : 2) : "—"}
                          </td>
                          <td className="p-3 text-right font-mono font-medium">
                            {livePnl !== null ? (
                              <span className={cn("flex items-center justify-end gap-1.5", livePnl >= 0 ? "text-profit" : "text-loss")}>
                                {livePnl >= 0 ? "+" : ""}${Math.abs(livePnl).toFixed(2)}
                                <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", livePnl >= 0 ? "bg-profit" : "bg-loss")} />
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">{pos.openedAt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {openPositions.length > ROWS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 px-1">
                  <span className="text-xs text-muted-foreground">Showing {((openPageClamped - 1) * ROWS_PER_PAGE) + 1}–{Math.min(openPageClamped * ROWS_PER_PAGE, openPositions.length)} of {openPositions.length}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setOpenPage(p => Math.max(1, p - 1))} disabled={openPageClamped <= 1} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="h-3.5 w-3.5" /></button>
                    {Array.from({ length: openTotalPages }, (_, i) => i + 1).map((page) => {
                      if (openTotalPages <= 7 || page === 1 || page === openTotalPages || Math.abs(page - openPageClamped) <= 1) {
                        return <button key={page} onClick={() => setOpenPage(page)} className={cn("h-7 min-w-[28px] rounded-md text-xs font-medium transition-colors", page === openPageClamped ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]")}>{page}</button>;
                      }
                      if (page === 2 || page === openTotalPages - 1) return <span key={page} className="text-xs text-muted-foreground px-1">…</span>;
                      return null;
                    })}
                    <button onClick={() => setOpenPage(p => Math.min(openTotalPages, p + 1))} disabled={openPageClamped >= openTotalPages} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>

        {/* Closed Positions Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Closed Positions</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground relative" onClick={() => setFilterOpen(!filterOpen)}>
              <Filter className="h-3.5 w-3.5" />
              {filtersActive && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
            </Button>
          </div>

          <ClosedPositionsFilter open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onApply={handleFiltersApply} symbols={uniqueSymbols} />

          {!accountsLoaded ? (
            <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div>
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
                  {paginatedClosed.map((pos) => {
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
                        <td className="p-3"><span className={pos.side === "Long" ? "badge-long" : "badge-short"}>{pos.side}</span></td>
                        <td className="p-3 text-right font-mono text-foreground">{pos.qty}</td>
                        <td className="p-3 text-right font-mono text-foreground">{pos.entry}</td>
                        <td className="p-3 text-right font-mono text-foreground">{pos.exit}</td>
                        <td className="p-3 text-right font-mono">
                          {risk !== null ? <span className={riskColor(risk)}>{risk.toFixed(1)}%</span> : <span className="text-muted-foreground">—</span>}
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
                    <tr><td colSpan={13} className="p-6 text-center text-muted-foreground text-sm">No closed positions yet. Import trades to get started.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {filteredPositions.length > ROWS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-xs text-muted-foreground">Showing {((closedPageClamped - 1) * ROWS_PER_PAGE) + 1}–{Math.min(closedPageClamped * ROWS_PER_PAGE, filteredPositions.length)} of {filteredPositions.length} trades</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setClosedPage((p) => Math.max(1, p - 1))} disabled={closedPageClamped <= 1}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="h-3.5 w-3.5" /></button>
                {Array.from({ length: closedTotalPages }, (_, i) => i + 1).map((page) => {
                  if (closedTotalPages <= 7 || page === 1 || page === closedTotalPages || Math.abs(page - closedPageClamped) <= 1) {
                    return <button key={page} onClick={() => setClosedPage(page)} className={cn("h-7 min-w-[28px] rounded-md text-xs font-medium transition-colors", page === closedPageClamped ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]")}>{page}</button>;
                  }
                  if (page === 2 || page === closedTotalPages - 1) return <span key={page} className="text-xs text-muted-foreground px-1">…</span>;
                  return null;
                })}
                <button onClick={() => setClosedPage((p) => Math.min(closedTotalPages, p + 1))} disabled={closedPageClamped >= closedTotalPages}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <TradeImportModal open={importOpen} onOpenChange={setImportOpen} accountId={selectedAccountId} onTradeCreated={refreshAll} />
      <CSVImportModal open={csvOpen} onOpenChange={setCsvOpen} accountId={selectedAccountId} onImportComplete={refreshAll} />
      <ManageAccountsModal open={manageOpen} onOpenChange={setManageOpen} accounts={accounts} onAccountsChange={setAccounts} userId={user?.id || ""} onBalanceRefresh={() => reconcile()} />
      <DepositWithdrawModal
        open={depositOpen} onOpenChange={setDepositOpen}
        accountId={selectedAccountId} userId={user?.id || ""}
        onTransactionComplete={refreshAll}
      />
    </div>
    </div>
  );
}
