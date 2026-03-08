/**
 * useAccountLedger — Single source of truth for all account financial metrics.
 *
 * Canonical balance formula:
 *   current_balance = initial_balance + deposits - withdrawals + realized_pnl
 *
 * Canonical equity formula:
 *   current_equity = current_balance + open_pnl
 *
 * All UI surfaces (Dashboard, Overview, Charts) MUST use this hook
 * instead of computing balance independently.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ── Types ── */

export interface LedgerEvent {
  id: string;
  timestamp: string;          // ISO string
  eventType: "starting_balance" | "deposit" | "withdrawal" | "closed_trade_pnl";
  amount: number;
  sourceId: string | null;    // trade_id, transaction_id, etc.
  symbol?: string;            // for trade events
}

export interface LedgerBreakdown {
  initialBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalRealizedPnl: number;
  totalCommissions: number;
  currentBalance: number;
}

export interface BalancePoint {
  date: string;
  balance: number;
  trades: { symbol: string; pnl: number }[];
}

export type BalancePeriod = "day" | "week" | "month" | "year";

/* ── Helpers ── */

function getPeriodStart(period: BalancePeriod): Date {
  const now = new Date();
  switch (period) {
    case "day":   return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "week":  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "month": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "year":  return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
}

function toDayStr(d: Date | string): string {
  return new Date(d).toISOString().split("T")[0];
}

/* ── Main Hook ── */

export function useAccountLedger(
  userId: string | undefined,
  accountId: string | undefined
) {
  const [breakdown, setBreakdown] = useState<LedgerBreakdown>({
    initialBalance: 0, totalDeposits: 0, totalWithdrawals: 0,
    totalRealizedPnl: 0, totalCommissions: 0, currentBalance: 0,
  });
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([]);
  const [periodPnl, setPeriodPnl] = useState<Record<string, number>>({ day: 0, week: 0, month: 0, year: 0 });
  const [loading, setLoading] = useState(false);

  /**
   * Core reconciliation — fetches raw data and builds the ledger.
   * This is the ONLY place balance is calculated.
   */
  const reconcile = useCallback(async () => {
    if (!userId || !accountId) {
      setBreakdown({ initialBalance: 0, totalDeposits: 0, totalWithdrawals: 0, totalRealizedPnl: 0, totalCommissions: 0, currentBalance: 0 });
      setLedgerEvents([]);
      setPeriodPnl({ day: 0, week: 0, month: 0, year: 0 });
      return;
    }

    setLoading(true);
    try {
      // Parallel fetch all data sources
      const [accRes, txnRes, tradesRes] = await Promise.all([
        supabase.from("accounts").select("initial_balance, balance, created_at").eq("id", accountId).single(),
        supabase.from("transactions").select("id, date, type, amount").eq("account_id", accountId).eq("user_id", userId).order("date", { ascending: true }),
        supabase.from("trades").select("id, close_time, pnl, commissions, symbol, status").eq("account_id", accountId).eq("user_id", userId).order("close_time", { ascending: true }),
      ]);

      const initialBalance = accRes.data ? Number(accRes.data.initial_balance ?? 0) : 0;
      const accountCreatedAt = accRes.data?.created_at || new Date().toISOString();
      const txns = txnRes.data || [];
      const allTrades = (tradesRes.data || []) as any[];
      const closedTrades = allTrades.filter(t => t.status === "closed");

      // ── Build ledger events ──
      const events: LedgerEvent[] = [];

      // Starting balance event
      events.push({
        id: `starting-${accountId}`,
        timestamp: accountCreatedAt,
        eventType: "starting_balance",
        amount: initialBalance,
        sourceId: accountId,
      });

      // Deposit & withdrawal events
      for (const tx of txns) {
        events.push({
          id: tx.id,
          timestamp: tx.date,
          eventType: tx.type === "deposit" ? "deposit" : "withdrawal",
          amount: Number(tx.amount) || 0,
          sourceId: tx.id,
        });
      }

      // Closed trade PnL events (net of commissions)
      for (const t of closedTrades) {
        if (!t.close_time) continue;
        const pnl = Number(t.pnl) || 0;
        const comm = Number(t.commissions) || 0;
        events.push({
          id: t.id,
          timestamp: t.close_time,
          eventType: "closed_trade_pnl",
          amount: pnl - comm,
          sourceId: t.id,
          symbol: t.symbol,
        });
      }

      // Sort by timestamp
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // ── Compute breakdown ──
      const totalDeposits = txns.filter(t => t.type === "deposit").reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const totalWithdrawals = txns.filter(t => t.type === "withdrawal").reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const totalRealizedPnl = closedTrades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
      const totalCommissions = closedTrades.reduce((s, t) => s + (Number(t.commissions) || 0), 0);
      const currentBalance = initialBalance + totalDeposits - totalWithdrawals + totalRealizedPnl - totalCommissions;

      setBreakdown({ initialBalance, totalDeposits, totalWithdrawals, totalRealizedPnl, totalCommissions, currentBalance });
      setLedgerEvents(events);

      // ── Write computed balance back to DB ──
      await supabase.from("accounts").update({ balance: currentBalance } as any).eq("id", accountId);

      // ── Compute period PnL ──
      const now = new Date();
      const periods: Record<string, Date> = {
        day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      };
      const pnlByPeriod: Record<string, number> = {};
      for (const [key, since] of Object.entries(periods)) {
        pnlByPeriod[key] = closedTrades
          .filter(t => t.close_time && new Date(t.close_time) >= since)
          .reduce((s, t) => s + ((Number(t.pnl) || 0) - (Number(t.commissions) || 0)), 0);
      }
      setPeriodPnl(pnlByPeriod);

    } catch (err) {
      console.error("[useAccountLedger] Reconciliation error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, accountId]);

  useEffect(() => { reconcile(); }, [reconcile]);

  /**
   * Generate balance time series for charts.
   * Uses the ledger events as the single source of truth.
   */
  const getBalanceSeries = useCallback((period: BalancePeriod): BalancePoint[] => {
    if (ledgerEvents.length === 0) return [];

    const periodStart = getPeriodStart(period);
    const periodStartStr = toDayStr(periodStart);
    const todayStr = toDayStr(new Date());

    // Build daily events map from ledger
    const dailyMap: Record<string, { delta: number; trades: { symbol: string; pnl: number }[] }> = {};
    const ensureDay = (day: string) => { if (!dailyMap[day]) dailyMap[day] = { delta: 0, trades: [] }; };

    let startingBal = 0;
    for (const evt of ledgerEvents) {
      if (evt.eventType === "starting_balance") {
        startingBal = evt.amount;
        continue;
      }
      const day = toDayStr(evt.timestamp);
      ensureDay(day);

      switch (evt.eventType) {
        case "deposit":
          dailyMap[day].delta += evt.amount;
          break;
        case "withdrawal":
          dailyMap[day].delta -= evt.amount;
          break;
        case "closed_trade_pnl":
          dailyMap[day].delta += evt.amount;
          dailyMap[day].trades.push({ symbol: evt.symbol || "UNKNOWN", pnl: evt.amount });
          break;
      }
    }

    // Calculate balance at period start by replaying events before period
    const allDays = Object.keys(dailyMap).sort();
    let balanceAtPeriodStart = startingBal;
    for (const day of allDays) {
      if (day >= periodStartStr) break;
      balanceAtPeriodStart += dailyMap[day].delta;
    }

    // Generate continuous daily points
    const points: BalancePoint[] = [];
    let running = balanceAtPeriodStart;
    const current = new Date(periodStart);
    const today = new Date();

    while (current <= today) {
      const dayStr = toDayStr(current);
      const dayEvent = dailyMap[dayStr];
      if (dayEvent) running += dayEvent.delta;

      const d = new Date(dayStr);
      let label: string;
      if (period === "day") {
        label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric" });
      } else if (period === "year") {
        label = d.toLocaleDateString("en-US", { month: "short" });
      } else {
        label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }

      points.push({ date: label, balance: running, trades: dayEvent?.trades || [] });
      current.setDate(current.getDate() + 1);
    }

    // Downsample year view to ~52 weekly points
    if (period === "year" && points.length > 52) {
      const sampled: BalancePoint[] = [];
      const step = Math.floor(points.length / 52);
      for (let i = 0; i < points.length; i += step) {
        const slice = points.slice(i, i + step);
        const last = slice[slice.length - 1];
        sampled.push({ ...last, trades: slice.flatMap(p => p.trades) });
      }
      if (sampled[sampled.length - 1] !== points[points.length - 1]) {
        sampled.push(points[points.length - 1]);
      }
      return sampled;
    }

    return points;
  }, [ledgerEvents]);

  return {
    breakdown,
    ledgerEvents,
    periodPnl,
    loading,
    reconcile,
    getBalanceSeries,
  };
}
