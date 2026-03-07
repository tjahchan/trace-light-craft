import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useOnboarding, getSampleData } from "@/contexts/OnboardingContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useBackground } from "@/contexts/BackgroundContext";

const PROFIT_COLOR = "hsl(142, 71%, 45%)";
const LOSS_COLOR = "hsl(0, 84%, 60%)";

const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getSession(closeTime: string | null): string {
  if (!closeTime) return "—";
  const h = new Date(closeTime).getUTCHours();
  if (h >= 0 && h < 9) return "Tokyo";
  if (h >= 8 && h < 17) return "London";
  if (h >= 13 && h < 22) return "New York";
  return "Off-hours";
}

export default function Overview() {
  const { sampleDataEnabled } = useOnboarding();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { calendarOpacity } = useBackground();
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [realTrades, setRealTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Fetch real trades
  const fetchTrades = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "closed")
      .order("close_time", { ascending: false });
    setRealTrades(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  // Listen for realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('overview-trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `user_id=eq.${user.id}` }, () => {
        fetchTrades();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchTrades]);

  const sample = getSampleData();

  const trades = useMemo(() => {
    if (sampleDataEnabled && realTrades.length === 0) {
      return sample.trades.map((t, i) => ({
        id: `sample-${i}`,
        pnl: t.pnl,
        close_time: `${t.date}T12:00:00Z`,
        symbol: t.symbol,
        side: t.side,
        entry_price: 0,
        exit_price: 0,
      }));
    }
    return realTrades;
  }, [sampleDataEnabled, realTrades, sample.trades]);

  // Stats
  const stats = useMemo(() => {
    if (trades.length === 0) {
      return { totalPnl: 0, todayPnl: 0, winRate: 0, avgWin: 0, avgLoss: 0, avgRR: 0, wins: 0, losses: 0, bestTrade: 0, worstTrade: 0, totalTrades: 0, mostTraded: "—", profitFactor: 0 };
    }
    const wins = trades.filter((t: any) => (t.pnl ?? 0) > 0);
    const losses = trades.filter((t: any) => (t.pnl ?? 0) < 0);
    const totalPnl = trades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
    const today = new Date().toISOString().split("T")[0];
    const todayPnl = trades.filter((t: any) => t.close_time?.startsWith(today)).reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
    const avgWin = wins.length > 0 ? wins.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0) / losses.length : 0;
    const winRate = Math.round((wins.length / trades.length) * 100);
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
    
    const symbolCount: Record<string, number> = {};
    trades.forEach((t: any) => { symbolCount[t.symbol] = (symbolCount[t.symbol] || 0) + 1; });
    const mostTraded = Object.entries(symbolCount).sort(([,a],[,b]) => b - a)[0]?.[0] || "—";

    return {
      totalPnl, todayPnl, winRate, avgWin, avgLoss,
      avgRR: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
      wins: wins.length, losses: losses.length,
      bestTrade: Math.max(...trades.map((t: any) => t.pnl ?? 0)),
      worstTrade: Math.min(...trades.map((t: any) => t.pnl ?? 0)),
      totalTrades: trades.length, mostTraded, profitFactor,
    };
  }, [trades]);

  // Session performance
  const sessionStats = useMemo(() => {
    const sessions: Record<string, { pnl: number; count: number; wins: number }> = {};
    trades.forEach((t: any) => {
      const s = getSession(t.close_time);
      if (!sessions[s]) sessions[s] = { pnl: 0, count: 0, wins: 0 };
      sessions[s].pnl += t.pnl ?? 0;
      sessions[s].count += 1;
      if ((t.pnl ?? 0) > 0) sessions[s].wins += 1;
    });
    return sessions;
  }, [trades]);

  const winrateData = [
    { name: "Wins", value: stats.wins || 1 },
    { name: "Losses", value: stats.losses || 1 },
  ];

  // Calendar data from real trades
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { day: number; pnl: number; trades: number; dateStr: string }[] = [];
    
    for (let i = 0; i < firstDay; i++) days.push({ day: 0, pnl: 0, trades: 0, dateStr: "" });
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayTrades = trades.filter((t: any) => t.close_time?.startsWith(dateStr));
      const dayPnl = dayTrades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
      days.push({ day: d, pnl: dayPnl, trades: dayTrades.length, dateStr });
    }
    
    return days;
  }, [trades, year, month]);

  // Trades for selected day
  const selectedDayTrades = useMemo(() => {
    if (!selectedDay) return [];
    return trades.filter((t: any) => t.close_time?.startsWith(selectedDay));
  }, [trades, selectedDay]);

  const monthlyPnl = calendarDays.reduce((sum, d) => sum + d.pnl, 0);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };

  const todayPnlPositive = stats.todayPnl >= 0;
  const totalPnlPositive = stats.totalPnl >= 0;

  return (
    <div className="flex gap-4 sm:gap-6 flex-col xl:flex-row">
      {/* Left Panel — Stats */}
      <div className="w-full xl:w-80 shrink-0 space-y-4 grid grid-cols-2 xl:grid-cols-1 gap-4 xl:gap-0 xl:space-y-4" data-tour="overview-stats">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Today's PnL</p>
          <div className="flex items-center gap-2">
            {todayPnlPositive ? <ArrowUpRight className="h-4 w-4 text-profit" /> : <ArrowDownRight className="h-4 w-4 text-loss" />}
            <span className={`text-2xl font-mono font-medium ${todayPnlPositive ? "text-profit" : "text-loss"}`}>
              {todayPnlPositive ? "+" : ""}${Math.abs(stats.todayPnl).toFixed(2)}
            </span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Overall PnL</p>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-mono font-medium ${totalPnlPositive ? "text-profit" : "text-loss"}`}>
              {totalPnlPositive ? "+" : ""}${Math.abs(stats.totalPnl).toFixed(2)}
            </span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-4 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Statistics</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground text-xs">Avg Win</p><p className="font-mono text-profit">${stats.avgWin.toFixed(2)}</p></div>
            <div><p className="text-muted-foreground text-xs">Avg Loss</p><p className="font-mono text-loss">-${Math.abs(stats.avgLoss).toFixed(2)}</p></div>
            <div><p className="text-muted-foreground text-xs">Avg RR</p><p className="font-mono text-foreground">{stats.avgRR.toFixed(2)}</p></div>
            <div><p className="text-muted-foreground text-xs">Win Rate</p><p className="font-mono text-foreground">{stats.winRate}%</p></div>
            <div><p className="text-muted-foreground text-xs">Wins</p><p className="font-mono text-profit">{stats.wins}</p></div>
            <div><p className="text-muted-foreground text-xs">Losses</p><p className="font-mono text-loss">{stats.losses}</p></div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Win Rate</p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={winrateData} cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="value" strokeWidth={0}>
                  <Cell fill={PROFIT_COLOR} />
                  <Cell fill={LOSS_COLOR} />
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-4 space-y-2">
          {[
            ["Best Trade", `+$${stats.bestTrade.toFixed(2)}`, "text-profit"],
            ["Worst Trade", `-$${Math.abs(stats.worstTrade).toFixed(2)}`, "text-loss"],
            ["Total Trades", `${stats.totalTrades}`, "text-foreground"],
            ["Most Traded", stats.mostTraded, "text-foreground"],
            ["Profit Factor", stats.profitFactor.toFixed(2), stats.profitFactor >= 1 ? "text-profit" : "text-foreground"],
          ].map(([label, value, cls]) => (
            <div key={label as string} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className={`font-mono ${cls}`}>{value}</span>
            </div>
          ))}
        </motion.div>

        {/* Session Performance */}
        {Object.keys(sessionStats).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Session Performance</p>
            {Object.entries(sessionStats).map(([session, data]) => (
              <div key={session} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{session}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground">{data.count} trades</span>
                  <span className={cn("font-mono", data.pnl >= 0 ? "text-profit" : "text-loss")}>
                    {data.pnl >= 0 ? "+" : ""}${Math.abs(data.pnl).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Right Panel — Calendar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex-1 min-w-0" data-tour="overview-calendar">
        <div className="backdrop-blur-xl border border-white/[0.1] rounded-2xl p-4 sm:p-6" style={{ backgroundColor: `rgba(0,0,0,${calendarOpacity / 100 * 0.4})` }}>
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="text-muted-foreground h-7 w-7"><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-center">
              <p className="font-semibold text-foreground">{monthNames[month]} {year}</p>
              <p className={`text-sm font-mono ${monthlyPnl >= 0 ? "text-profit" : "text-loss"}`}>
                {monthlyPnl >= 0 ? "+" : ""}${Math.abs(monthlyPnl).toFixed(2)}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="text-muted-foreground h-7 w-7"><ChevronRight className="h-4 w-4" /></Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="text-center text-[10px] text-muted-foreground uppercase tracking-wider py-2">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              const isToday = day.dateStr === new Date().toISOString().split("T")[0];
              return (
                <div
                  key={i}
                  onClick={() => day.day > 0 && day.trades > 0 && setSelectedDay(day.dateStr)}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors",
                    day.day === 0 ? "" : "cursor-pointer",
                    day.day > 0 && day.trades > 0 && "hover:bg-white/[0.08]",
                    day.day > 0 && day.trades > 0 && day.pnl >= 0 && "bg-profit/10 border border-profit/20",
                    day.day > 0 && day.trades > 0 && day.pnl < 0 && "bg-loss/10 border border-loss/20",
                    isToday && "ring-1 ring-primary/50",
                    selectedDay === day.dateStr && "ring-2 ring-primary"
                  )}
                >
                  {day.day > 0 && (
                    <>
                      <span className="text-muted-foreground text-[10px]">{day.day}</span>
                      {day.trades > 0 && (
                        <>
                          <span className={`font-mono text-[11px] font-medium ${day.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                            {day.pnl >= 0 ? "+" : ""}${Math.abs(day.pnl).toFixed(0)}
                          </span>
                          <span className="text-[9px] text-muted-foreground/70">{day.trades} {day.trades === 1 ? "Trade" : "Trades"}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Detail Panel */}
        <AnimatePresence>
          {selectedDay && selectedDayTrades.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="mt-4 backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Trades on {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h3>
                <button onClick={() => setSelectedDay(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.05]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {selectedDayTrades.map((t: any) => {
                  const pnl = t.pnl ?? 0;
                  const session = getSession(t.close_time);
                  return (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium text-foreground text-sm">{t.symbol}</span>
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", t.side === "Long" ? "bg-profit/20 text-profit" : "bg-loss/20 text-loss")}>{t.side}</span>
                        <span className="text-xs text-muted-foreground">{session}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-xs text-muted-foreground">
                          <span>{t.entry_price} → {t.exit_price ?? "—"}</span>
                        </div>
                        <span className={cn("font-mono font-medium text-sm", pnl >= 0 ? "text-profit" : "text-loss")}>
                          {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
                        </span>
                        <button
                          onClick={() => navigate(`/trade/${t.id}`)}
                          className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                          title="Open in Journal"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between text-sm">
                <span className="text-muted-foreground">Day Total</span>
                <span className={cn("font-mono font-medium", selectedDayTrades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0) >= 0 ? "text-profit" : "text-loss")}>
                  {(() => { const total = selectedDayTrades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0); return `${total >= 0 ? "+" : ""}$${Math.abs(total).toFixed(2)}`; })()}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
