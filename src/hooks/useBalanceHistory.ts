import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BalancePeriod = "day" | "week" | "month" | "year";

interface BalancePoint {
  date: string;
  balance: number;
  trades: { symbol: string; pnl: number }[];
}

function getPeriodStart(period: BalancePeriod): Date {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "year":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
}

export function useBalanceHistory(
  userId: string | undefined,
  accountId: string | undefined,
  period: BalancePeriod
) {
  const [chartData, setChartData] = useState<BalancePoint[]>([]);
  const [loading, setLoading] = useState(false);

  const buildChart = useCallback(async () => {
    if (!userId || !accountId) {
      setChartData([]);
      return;
    }
    setLoading(true);
    try {
      // Get account initial balance
      const { data: accRow } = await supabase
        .from("accounts")
        .select("initial_balance, balance, created_at")
        .eq("id", accountId)
        .single();

      const initialBalance = accRow ? Number((accRow as any).initial_balance ?? accRow.balance ?? 0) : 0;

      // Get all transactions
      const { data: txns } = await supabase
        .from("transactions")
        .select("date, type, amount")
        .eq("account_id", accountId)
        .eq("user_id", userId)
        .order("date", { ascending: true });

      // Get all closed trades
      const { data: trades } = await supabase
        .from("trades" as any)
        .select("close_time, pnl, symbol")
        .eq("account_id", accountId)
        .eq("user_id", userId)
        .eq("status", "closed")
        .order("close_time", { ascending: true });

      // Build daily events map
      const events: Record<string, { delta: number; trades: { symbol: string; pnl: number }[] }> = {};

      const ensureDay = (day: string) => {
        if (!events[day]) events[day] = { delta: 0, trades: [] };
      };

      if (txns) {
        for (const tx of txns) {
          const day = new Date(tx.date).toISOString().split("T")[0];
          ensureDay(day);
          const amt = Number(tx.amount) || 0;
          events[day].delta += tx.type === "deposit" ? amt : -amt;
        }
      }
      if (trades) {
        for (const t of trades as any[]) {
          if (!t.close_time) continue;
          const day = new Date(t.close_time).toISOString().split("T")[0];
          ensureDay(day);
          const pnl = Number(t.pnl) || 0;
          events[day].delta += pnl;
          events[day].trades.push({ symbol: t.symbol, pnl });
        }
      }

      // Determine date range based on period
      const periodStart = getPeriodStart(period);
      const periodStartStr = periodStart.toISOString().split("T")[0];
      const todayStr = new Date().toISOString().split("T")[0];

      // Get all event days sorted
      const allDays = Object.keys(events).sort();

      // Calculate balance at period start by replaying events before period
      let balanceAtPeriodStart = initialBalance;
      for (const day of allDays) {
        if (day >= periodStartStr) break;
        balanceAtPeriodStart += events[day].delta;
      }

      // Generate every day in the period range
      const points: BalancePoint[] = [];
      let running = balanceAtPeriodStart;
      const current = new Date(periodStart);
      const today = new Date();

      while (current <= today) {
        const dayStr = current.toISOString().split("T")[0];
        const dayEvent = events[dayStr];

        if (dayEvent) {
          running += dayEvent.delta;
        }

        const d = new Date(dayStr);
        let label: string;
        if (period === "day") {
          label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric" });
        } else if (period === "year") {
          label = d.toLocaleDateString("en-US", { month: "short" });
        } else {
          label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }

        points.push({
          date: label,
          balance: running,
          trades: dayEvent?.trades || [],
        });

        current.setDate(current.getDate() + 1);
      }

      // For year view, downsample to weekly points to avoid overcrowding
      if (period === "year" && points.length > 52) {
        const sampled: BalancePoint[] = [];
        const step = Math.floor(points.length / 52);
        for (let i = 0; i < points.length; i += step) {
          const slice = points.slice(i, i + step);
          const last = slice[slice.length - 1];
          const allTrades = slice.flatMap(p => p.trades);
          sampled.push({ ...last, trades: allTrades });
        }
        // Always include the last point
        if (sampled[sampled.length - 1] !== points[points.length - 1]) {
          sampled.push(points[points.length - 1]);
        }
        setChartData(sampled);
      } else {
        setChartData(points);
      }
    } catch (err) {
      console.error("[useBalanceHistory] Error:", err);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [userId, accountId, period]);

  useEffect(() => {
    buildChart();
  }, [buildChart]);

  return { chartData, loading, refresh: buildChart };
}
