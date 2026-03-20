/**
 * Options Engine — Type Definitions
 * Strict types, enums, and interfaces for the options journal module.
 */

// ─── Enums / Unions ───────────────────────────────────────────

export type OptionType = "call" | "put";
export type PositionSide = "long" | "short";

export type OptionTradeStatus =
  | "open"
  | "closed"
  | "expired_worthless"
  | "assigned"
  | "exercised";

export type Moneyness = "ITM" | "ATM" | "OTM";

export type ReturnBasis =
  | "capital_outlay"
  | "capital_at_risk"
  | "margin_used"
  | "premium_collected"
  | "custom";

export type StrategyType =
  | "single_leg"
  | "vertical_spread"
  | "iron_condor"
  | "straddle"
  | "strangle"
  | "butterfly"
  | "calendar_spread"
  | "custom";

// ─── Leg-Level Raw Input ──────────────────────────────────────

export interface OptionLegInput {
  optionType: OptionType;
  positionSide: PositionSide;
  strikePrice: number;
  expirationDate: string | null;       // ISO date string
  multiplier: number;                  // default 100
  contracts: number;                   // integer > 0

  entryPremium: number;                // per-share
  exitPremium?: number | null;
  currentPremium?: number | null;

  entryDateTime: string | null;        // ISO datetime
  exitDateTime?: string | null;

  entryFees: number;
  exitFees: number;

  underlyingPriceEntry?: number | null;
  underlyingPriceExit?: number | null;
  underlyingPriceCurrent?: number | null;

  entryIV?: number | null;
  exitIV?: number | null;
  currentIV?: number | null;

  delta?: number | null;
  gamma?: number | null;
  theta?: number | null;
  vega?: number | null;
  rho?: number | null;

  capitalAtRisk?: number | null;
  marginUsed?: number | null;

  status: OptionTradeStatus;
}

// ─── Computed Metrics for a Single Leg ────────────────────────

export interface OptionLegMetrics {
  premiumValuePerContract: number;
  totalPremiumValue: number;

  totalEntryCost: number;          // long: outflow (positive); short: credit received (positive)
  totalExitValue: number | null;   // long: proceeds; short: buyback cost

  realizedPnl: number | null;
  unrealizedPnl: number | null;

  returnPct: number | null;
  returnBasis: ReturnBasis;
  returnBasisLabel: string;

  breakEvenPrice: number;

  maxProfit: number | null;        // null = unlimited
  maxProfitLabel: string;
  maxLoss: number | null;          // null = unlimited
  maxLossLabel: string;

  intrinsicValuePerShare: number | null;
  extrinsicValuePerShare: number | null;

  moneyness: Moneyness | null;

  entryNotional: number | null;
  currentNotional: number | null;

  distanceToStrikePct: number | null;

  daysToExpirationAtEntry: number | null;
  daysRemaining: number | null;
  holdDuration: number | null;

  totalFees: number;
}

// ─── Calculation Result Envelope ──────────────────────────────

export interface OptionCalculationResult {
  metrics: OptionLegMetrics;
  errors: string[];
  warnings: string[];
  meta: {
    returnBasis: ReturnBasis;
    priceSourceUsed: "currentPremium" | "exitPremium" | "entryPremium";
    underlyingSourceUsed: "current" | "exit" | "entry" | "none";
    statusInterpretation: string;
  };
}

// ─── Trade-Level Aggregates (future multi-leg) ────────────────

export interface TradeAggregates {
  totalRealizedPnl: number | null;
  totalUnrealizedPnl: number | null;
  netPremiumPaid: number;
  netPremiumCollected: number;
  netFees: number;
  totalContracts: number;
  totalMaxRisk: number | null;     // null if any leg has unlimited risk
}

// ─── Validation Result ────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Analytics Helpers ────────────────────────────────────────

export type DteBucket = "0-7" | "8-14" | "15-30" | "31-60" | "61-90" | "90+";
export type DeltaBucket = "0-0.15" | "0.15-0.30" | "0.30-0.50" | "0.50-0.70" | "0.70-1.00";
export type IvBucket = "low" | "medium" | "high" | "extreme";
export type PnlCategory = "big_win" | "small_win" | "breakeven" | "small_loss" | "big_loss";
