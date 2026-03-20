/**
 * Options Engine — Centralized Calculation Module
 *
 * All formulas live here. Premium is per-share; the multiplier converts to
 * per-contract dollars. Every function is pure and deterministic.
 */

import type {
  OptionType,
  PositionSide,
  OptionTradeStatus,
  OptionLegInput,
  OptionLegMetrics,
  OptionCalculationResult,
  TradeAggregates,
  Moneyness,
  ReturnBasis,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────

function daysBetween(a: string | Date, b: string | Date): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Resolve the best available underlying price */
function resolveUnderlying(
  current?: number | null,
  exit?: number | null,
  entry?: number | null,
): { price: number | null; source: "current" | "exit" | "entry" | "none" } {
  if (current != null && current > 0) return { price: current, source: "current" };
  if (exit != null && exit > 0) return { price: exit, source: "exit" };
  if (entry != null && entry > 0) return { price: entry, source: "entry" };
  return { price: null, source: "none" };
}

/** Resolve best available market price for the option */
function resolveMarketPrice(
  currentPremium?: number | null,
  exitPremium?: number | null,
  entryPremium?: number,
): { price: number; source: "currentPremium" | "exitPremium" | "entryPremium" } {
  if (currentPremium != null && currentPremium >= 0)
    return { price: currentPremium, source: "currentPremium" };
  if (exitPremium != null && exitPremium >= 0)
    return { price: exitPremium, source: "exitPremium" };
  return { price: entryPremium ?? 0, source: "entryPremium" };
}

// ─── Moneyness ────────────────────────────────────────────────

export function deriveMoneyness(
  optionType: OptionType,
  strikePrice: number,
  underlyingPrice: number | null,
  atmThresholdPct: number = 0.005,
): Moneyness | null {
  if (underlyingPrice == null || underlyingPrice <= 0 || strikePrice <= 0)
    return null;

  const threshold = underlyingPrice * atmThresholdPct;

  if (optionType === "call") {
    if (underlyingPrice > strikePrice + threshold) return "ITM";
    if (underlyingPrice < strikePrice - threshold) return "OTM";
    return "ATM";
  } else {
    if (underlyingPrice < strikePrice - threshold) return "ITM";
    if (underlyingPrice > strikePrice + threshold) return "OTM";
    return "ATM";
  }
}

// ─── Break-Even ───────────────────────────────────────────────

export function deriveBreakEven(
  optionType: OptionType,
  strikePrice: number,
  entryPremium: number,
): number {
  return optionType === "call"
    ? strikePrice + entryPremium
    : strikePrice - entryPremium;
}

// ─── Max Profit / Max Loss ────────────────────────────────────

export function deriveMaxProfitLoss(
  optionType: OptionType,
  positionSide: PositionSide,
  strikePrice: number,
  entryPremium: number,
  multiplier: number,
  contracts: number,
  totalFees: number,
): {
  maxProfit: number | null;
  maxProfitLabel: string;
  maxLoss: number | null;
  maxLossLabel: string;
} {
  const isLong = positionSide === "long";
  const isCall = optionType === "call";
  const rawEntry = entryPremium * multiplier * contracts;

  if (isLong && isCall) {
    const maxLoss = rawEntry + totalFees;
    return {
      maxProfit: null,
      maxProfitLabel: "Unlimited",
      maxLoss,
      maxLossLabel: formatCurrency(maxLoss),
    };
  }

  if (isLong && !isCall) {
    const maxLoss = rawEntry + totalFees;
    // Underlying floors at 0: max profit = (strike - premium) * mult * contracts - fees
    const maxProfit = Math.max(
      (strikePrice - entryPremium) * multiplier * contracts - totalFees,
      0,
    );
    return {
      maxProfit,
      maxProfitLabel: formatCurrency(maxProfit),
      maxLoss,
      maxLossLabel: formatCurrency(maxLoss),
    };
  }

  if (!isLong && isCall) {
    const maxProfit = rawEntry - totalFees;
    return {
      maxProfit: Math.max(maxProfit, 0),
      maxProfitLabel: formatCurrency(Math.max(maxProfit, 0)),
      maxLoss: null,
      maxLossLabel: "Unlimited",
    };
  }

  // Short put
  const maxProfit = rawEntry - totalFees;
  const maxLoss =
    (strikePrice - entryPremium) * multiplier * contracts + totalFees;
  return {
    maxProfit: Math.max(maxProfit, 0),
    maxProfitLabel: formatCurrency(Math.max(maxProfit, 0)),
    maxLoss: Math.max(maxLoss, 0),
    maxLossLabel: formatCurrency(Math.max(maxLoss, 0)),
  };
}

// ─── Intrinsic / Extrinsic ───────────────────────────────────

export function deriveIntrinsicValue(
  optionType: OptionType,
  strikePrice: number,
  underlyingPrice: number | null,
): number | null {
  if (underlyingPrice == null || underlyingPrice <= 0) return null;
  return optionType === "call"
    ? Math.max(underlyingPrice - strikePrice, 0)
    : Math.max(strikePrice - underlyingPrice, 0);
}

export function deriveExtrinsicValue(
  marketPrice: number,
  intrinsicValue: number | null,
): number | null {
  if (intrinsicValue == null) return null;
  return marketPrice - intrinsicValue;
}

// ─── Core Leg Calculator ──────────────────────────────────────

export function calculateOptionLeg(input: OptionLegInput): OptionCalculationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isLong = input.positionSide === "long";
  const isCall = input.optionType === "call";
  const mult = input.multiplier || 100;
  const totalFees = (input.entryFees || 0) + (input.exitFees || 0);

  // ── Effective exit premium based on status
  let effectiveExitPremium: number | null | undefined = input.exitPremium;
  let statusInterpretation = input.status;

  if (input.status === "expired_worthless") {
    effectiveExitPremium = 0;
    statusInterpretation = "expired_worthless";
  }

  // ── Premium values
  const premiumValuePerContract = input.entryPremium * mult;
  const totalPremiumValue = input.entryPremium * mult * input.contracts;

  // ── Total entry cost / credit
  const rawEntry = input.entryPremium * mult * input.contracts;
  const totalEntryCost = isLong
    ? rawEntry + (input.entryFees || 0)
    : rawEntry - (input.entryFees || 0);

  // ── Total exit value
  let totalExitValue: number | null = null;
  if (effectiveExitPremium != null) {
    const rawExit = effectiveExitPremium * mult * input.contracts;
    totalExitValue = isLong
      ? rawExit - (input.exitFees || 0)
      : rawExit + (input.exitFees || 0);
  }

  // ── Realized P&L (closed / expired / assigned / exercised)
  let realizedPnl: number | null = null;
  if (input.status !== "open" && effectiveExitPremium != null) {
    if (isLong) {
      realizedPnl =
        (effectiveExitPremium - input.entryPremium) * mult * input.contracts -
        totalFees;
    } else {
      realizedPnl =
        (input.entryPremium - effectiveExitPremium) * mult * input.contracts -
        totalFees;
    }
  }

  // ── Unrealized P&L (open trades only)
  let unrealizedPnl: number | null = null;
  if (input.status === "open" && input.currentPremium != null) {
    if (isLong) {
      unrealizedPnl =
        (input.currentPremium - input.entryPremium) * mult * input.contracts -
        (input.entryFees || 0);
    } else {
      unrealizedPnl =
        (input.entryPremium - input.currentPremium) * mult * input.contracts -
        (input.entryFees || 0);
    }
  } else if (input.status === "open" && input.currentPremium == null) {
    warnings.push("No current premium provided for open trade — unrealized P&L unavailable");
  }

  // ── Return %
  let returnPct: number | null = null;
  let returnBasis: ReturnBasis = "capital_outlay";
  let returnBasisLabel = "Return %";
  const pnlValue = realizedPnl ?? unrealizedPnl;

  if (pnlValue != null) {
    if (isLong) {
      if (totalEntryCost > 0) {
        returnPct = (pnlValue / totalEntryCost) * 100;
        returnBasis = "capital_outlay";
        returnBasisLabel = "Return on Capital Outlay";
      }
    } else {
      // Short: use best available denominator
      if (input.capitalAtRisk != null && input.capitalAtRisk > 0) {
        returnPct = (pnlValue / input.capitalAtRisk) * 100;
        returnBasis = "capital_at_risk";
        returnBasisLabel = "Return on Capital at Risk";
      } else if (input.marginUsed != null && input.marginUsed > 0) {
        returnPct = (pnlValue / input.marginUsed) * 100;
        returnBasis = "margin_used";
        returnBasisLabel = "Return on Margin";
      } else {
        // Fallback: premium collected basis
        const premiumBasis = rawEntry;
        if (premiumBasis > 0) {
          returnPct = (pnlValue / premiumBasis) * 100;
          returnBasis = "premium_collected";
          returnBasisLabel = "Return on Premium Collected (approx.)";
          warnings.push(
            "Short trade return % uses premium collected as basis — provide Capital at Risk or Margin for accuracy",
          );
        }
      }
    }
  }

  // ── Break-even
  const breakEvenPrice = deriveBreakEven(input.optionType, input.strikePrice, input.entryPremium);

  // ── Max profit / loss
  const { maxProfit, maxProfitLabel, maxLoss, maxLossLabel } = deriveMaxProfitLoss(
    input.optionType,
    input.positionSide,
    input.strikePrice,
    input.entryPremium,
    mult,
    input.contracts,
    totalFees,
  );

  // ── Underlying resolution
  const underlying = resolveUnderlying(
    input.underlyingPriceCurrent,
    input.underlyingPriceExit,
    input.underlyingPriceEntry,
  );

  // ── Intrinsic / extrinsic
  const intrinsicValuePerShare = deriveIntrinsicValue(
    input.optionType,
    input.strikePrice,
    underlying.price,
  );

  const { price: marketPrice, source: priceSource } = resolveMarketPrice(
    input.currentPremium,
    effectiveExitPremium,
    input.entryPremium,
  );

  const extrinsicValuePerShare = deriveExtrinsicValue(marketPrice, intrinsicValuePerShare);

  if (extrinsicValuePerShare != null && extrinsicValuePerShare < -0.01) {
    warnings.push(
      `Negative extrinsic value ($${extrinsicValuePerShare.toFixed(2)}) — verify premium and underlying inputs`,
    );
  }

  // ── Moneyness
  const moneyness = deriveMoneyness(input.optionType, input.strikePrice, underlying.price);

  // ── Notional exposure
  const entryNotional =
    input.underlyingPriceEntry != null
      ? input.underlyingPriceEntry * mult * input.contracts
      : null;

  const currentNotional =
    underlying.price != null ? underlying.price * mult * input.contracts : null;

  // ── Distance to strike
  let distanceToStrikePct: number | null = null;
  if (underlying.price != null && underlying.price > 0) {
    distanceToStrikePct = isCall
      ? ((input.strikePrice - underlying.price) / underlying.price) * 100
      : ((underlying.price - input.strikePrice) / underlying.price) * 100;
  }

  // ── Days metrics
  let daysToExpirationAtEntry: number | null = null;
  let daysRemaining: number | null = null;
  let holdDuration: number | null = null;

  if (input.expirationDate) {
    if (input.entryDateTime) {
      daysToExpirationAtEntry = daysBetween(input.entryDateTime, input.expirationDate);
    }
    if (input.status === "open") {
      daysRemaining = daysBetween(new Date().toISOString(), input.expirationDate);
    }
  }

  if (input.entryDateTime && input.exitDateTime) {
    holdDuration = daysBetween(input.entryDateTime, input.exitDateTime);
  }

  // ── Status-based warnings
  if (input.status === "assigned") {
    warnings.push("Assignment accounting is approximate — stock settlement not yet modeled");
  }
  if (input.status === "exercised") {
    warnings.push("Exercise accounting is approximate — stock settlement not yet modeled");
  }
  if (
    input.status === "open" &&
    input.expirationDate &&
    new Date(input.expirationDate) < new Date()
  ) {
    warnings.push("Expiration date has passed but trade is still marked Open");
  }

  const metrics: OptionLegMetrics = {
    premiumValuePerContract,
    totalPremiumValue,
    totalEntryCost,
    totalExitValue,
    realizedPnl,
    unrealizedPnl,
    returnPct,
    returnBasis,
    returnBasisLabel,
    breakEvenPrice,
    maxProfit,
    maxProfitLabel,
    maxLoss,
    maxLossLabel,
    intrinsicValuePerShare,
    extrinsicValuePerShare,
    moneyness,
    entryNotional,
    currentNotional,
    distanceToStrikePct,
    daysToExpirationAtEntry,
    daysRemaining,
    holdDuration,
    totalFees,
  };

  return {
    metrics,
    errors,
    warnings,
    meta: {
      returnBasis,
      priceSourceUsed: priceSource,
      underlyingSourceUsed: underlying.source,
      statusInterpretation: String(statusInterpretation),
    },
  };
}

// ─── Trade-Level Aggregation ──────────────────────────────────

export function calculateTradeAggregates(legs: OptionLegInput[]): TradeAggregates {
  let totalRealizedPnl: number | null = null;
  let totalUnrealizedPnl: number | null = null;
  let netPremiumPaid = 0;
  let netPremiumCollected = 0;
  let netFees = 0;
  let totalContracts = 0;
  let totalMaxRisk: number | null = 0;

  for (const leg of legs) {
    const result = calculateOptionLeg(leg);
    const m = result.metrics;

    if (m.realizedPnl != null) {
      totalRealizedPnl = (totalRealizedPnl ?? 0) + m.realizedPnl;
    }
    if (m.unrealizedPnl != null) {
      totalUnrealizedPnl = (totalUnrealizedPnl ?? 0) + m.unrealizedPnl;
    }

    if (leg.positionSide === "long") {
      netPremiumPaid += m.totalPremiumValue;
    } else {
      netPremiumCollected += m.totalPremiumValue;
    }

    netFees += m.totalFees;
    totalContracts += leg.contracts;

    // If any leg has unlimited risk, total risk is null
    if (totalMaxRisk != null) {
      if (m.maxLoss == null) {
        totalMaxRisk = null;
      } else {
        totalMaxRisk += m.maxLoss;
      }
    }
  }

  return {
    totalRealizedPnl,
    totalUnrealizedPnl,
    netPremiumPaid,
    netPremiumCollected,
    netFees,
    totalContracts,
    totalMaxRisk,
  };
}

// ─── Formatting Utilities ─────────────────────────────────────

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPnl(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Safe currency rounding to 2 decimal places */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Safe percentage rounding */
export function roundPercent(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
