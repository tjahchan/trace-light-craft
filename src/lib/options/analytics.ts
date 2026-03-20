/**
 * Options Engine — Analytics Helpers
 *
 * Pure functions for classification, bucketing, and aggregation
 * that power the options analytics dashboard.
 */

import type {
  OptionLegInput,
  OptionLegMetrics,
  DteBucket,
  DeltaBucket,
  IvBucket,
  PnlCategory,
  Moneyness,
} from "./types";

// ─── Win / Loss Classification ────────────────────────────────

export function isWinner(pnl: number | null): boolean | null {
  if (pnl == null) return null;
  return pnl > 0;
}

export function isLoser(pnl: number | null): boolean | null {
  if (pnl == null) return null;
  return pnl < 0;
}

// ─── Hold Duration ────────────────────────────────────────────

export function holdDurationDays(
  entryDateTime: string | null,
  exitDateTime: string | null,
): number | null {
  if (!entryDateTime || !exitDateTime) return null;
  const ms = new Date(exitDateTime).getTime() - new Date(entryDateTime).getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

// ─── DTE Bucket ───────────────────────────────────────────────

export function dteBucket(dte: number | null): DteBucket | null {
  if (dte == null) return null;
  if (dte <= 7) return "0-7";
  if (dte <= 14) return "8-14";
  if (dte <= 30) return "15-30";
  if (dte <= 60) return "31-60";
  if (dte <= 90) return "61-90";
  return "90+";
}

// ─── Delta Bucket ─────────────────────────────────────────────

export function deltaBucket(delta: number | null): DeltaBucket | null {
  if (delta == null) return null;
  const d = Math.abs(delta);
  if (d < 0.15) return "0-0.15";
  if (d < 0.30) return "0.15-0.30";
  if (d < 0.50) return "0.30-0.50";
  if (d < 0.70) return "0.50-0.70";
  return "0.70-1.00";
}

// ─── IV Bucket ────────────────────────────────────────────────

export function ivBucket(iv: number | null): IvBucket | null {
  if (iv == null) return null;
  if (iv < 20) return "low";
  if (iv < 40) return "medium";
  if (iv < 60) return "high";
  return "extreme";
}

// ─── P&L Category ─────────────────────────────────────────────

export function pnlCategory(
  pnl: number | null,
  entryValue: number,
): PnlCategory | null {
  if (pnl == null || entryValue <= 0) return null;
  const pct = (pnl / entryValue) * 100;
  if (pct > 20) return "big_win";
  if (pct > 0) return "small_win";
  if (pct > -5) return "breakeven";
  if (pct > -20) return "small_loss";
  return "big_loss";
}

// ─── Position Label ───────────────────────────────────────────

export function getPositionLabel(
  positionSide: string,
  optionType: string,
): string {
  const d = positionSide === "long" ? "Long" : "Short";
  const o = optionType === "call" ? "Call" : "Put";
  return `${d} ${o}`;
}

// ─── Moneyness Badge ──────────────────────────────────────────

export function getMoneynessBadge(m: Moneyness | null): {
  label: string;
  className: string;
} {
  switch (m) {
    case "ITM":
      return { label: "ITM", className: "bg-profit/15 text-profit border-profit/25" };
    case "ATM":
      return { label: "ATM", className: "bg-amber-500/15 text-amber-400 border-amber-500/25" };
    case "OTM":
      return { label: "OTM", className: "bg-loss/15 text-loss border-loss/25" };
    default:
      return { label: "—", className: "bg-white/5 text-muted-foreground border-white/10" };
  }
}

// ─── Batch Analytics ──────────────────────────────────────────

export interface OptionsTradeSummary {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnl: number;
  avgWinner: number;
  avgLoser: number;
  avgReturnPct: number;
  avgHoldDays: number;
  totalPremiumPaid: number;
  totalPremiumCollected: number;
  bestTradePnl: number;
  worstTradePnl: number;
}

export function computeOptionsSummary(
  trades: Array<{
    leg: OptionLegInput;
    metrics: OptionLegMetrics;
  }>,
): OptionsTradeSummary {
  const closed = trades.filter(
    (t) => t.leg.status !== "open" && t.metrics.realizedPnl != null,
  );

  const pnls = closed.map((t) => t.metrics.realizedPnl!);
  const winners = pnls.filter((p) => p > 0);
  const losers = pnls.filter((p) => p < 0);

  const totalPnl = pnls.reduce((a, b) => a + b, 0);
  const winCount = winners.length;
  const lossCount = losers.length;
  const winRate = closed.length > 0 ? (winCount / closed.length) * 100 : 0;
  const avgWinner =
    winners.length > 0 ? winners.reduce((a, b) => a + b, 0) / winners.length : 0;
  const avgLoser =
    losers.length > 0 ? losers.reduce((a, b) => a + b, 0) / losers.length : 0;

  const returnPcts = closed
    .map((t) => t.metrics.returnPct)
    .filter((r): r is number => r != null);
  const avgReturnPct =
    returnPcts.length > 0
      ? returnPcts.reduce((a, b) => a + b, 0) / returnPcts.length
      : 0;

  const holdDays = closed
    .map((t) => t.metrics.holdDuration)
    .filter((d): d is number => d != null);
  const avgHoldDays =
    holdDays.length > 0
      ? holdDays.reduce((a, b) => a + b, 0) / holdDays.length
      : 0;

  let totalPremiumPaid = 0;
  let totalPremiumCollected = 0;
  for (const t of trades) {
    if (t.leg.positionSide === "long") {
      totalPremiumPaid += t.metrics.totalPremiumValue;
    } else {
      totalPremiumCollected += t.metrics.totalPremiumValue;
    }
  }

  return {
    totalTrades: closed.length,
    winCount,
    lossCount,
    winRate,
    totalPnl,
    avgWinner,
    avgLoser,
    avgReturnPct,
    avgHoldDays,
    totalPremiumPaid,
    totalPremiumCollected,
    bestTradePnl: pnls.length > 0 ? Math.max(...pnls) : 0,
    worstTradePnl: pnls.length > 0 ? Math.min(...pnls) : 0,
  };
}
