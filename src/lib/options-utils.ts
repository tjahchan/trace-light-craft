/**
 * Options Trade Calculation Engine — Legacy Compatibility Layer
 *
 * Re-exports from the modular options engine at src/lib/options/.
 * Existing imports from this file continue to work unchanged.
 */

export type { Moneyness } from "./options/types";
export type { OptionType, PositionSide as PositionDirection, OptionTradeStatus as OptionStatus } from "./options/types";

// Legacy OptionsTradeInput shape mapped to new OptionLegInput
export interface OptionsTradeInput {
  optionType: "call" | "put";
  positionDirection: "long" | "short";
  strikePrice: number;
  entryPremium: number;
  exitPremium?: number | null;
  currentPremium?: number | null;
  numContracts: number;
  contractMultiplier: number;
  entryFees: number;
  exitFees: number;
  underlyingPriceEntry?: number | null;
  underlyingPriceExit?: number | null;
  underlyingPriceCurrent?: number | null;
  expirationDate?: string | null;
  entryDate?: string | null;
  capitalAtRisk?: number | null;
  status: "open" | "closed" | "expired" | "assigned" | "exercised";
}

export interface OptionsCalculations {
  premiumValuePerContract: number;
  totalEntryCost: number;
  totalExitValue: number | null;
  realizedPnl: number | null;
  unrealizedPnl: number | null;
  percentReturn: number | null;
  percentReturnLabel: string;
  breakEven: number;
  maxProfit: number | null;
  maxProfitLabel: string;
  maxLoss: number | null;
  maxLossLabel: string;
  intrinsicValue: number | null;
  extrinsicValue: number | null;
  notionalExposure: number | null;
  distanceToStrikePct: number | null;
  moneyness: "ITM" | "ATM" | "OTM" | null;
  daysToExpiration: number | null;
  daysRemaining: number | null;
  totalFees: number;
}

import { calculateOptionLeg } from "./options/calculations";
import type { OptionLegInput, OptionTradeStatus } from "./options/types";

/** Map legacy status to new status */
function mapStatus(s: string): OptionTradeStatus {
  if (s === "expired") return "expired_worthless";
  return s as OptionTradeStatus;
}

/**
 * Legacy-compatible calculation function.
 * Delegates to the new modular engine internally.
 */
export function calculateOptions(input: OptionsTradeInput): OptionsCalculations {
  const legInput: OptionLegInput = {
    optionType: input.optionType,
    positionSide: input.positionDirection,
    strikePrice: input.strikePrice,
    expirationDate: input.expirationDate ?? null,
    multiplier: input.contractMultiplier || 100,
    contracts: input.numContracts,
    entryPremium: input.entryPremium,
    exitPremium: input.exitPremium,
    currentPremium: input.currentPremium,
    entryDateTime: input.entryDate ?? null,
    exitDateTime: null,
    entryFees: input.entryFees || 0,
    exitFees: input.exitFees || 0,
    underlyingPriceEntry: input.underlyingPriceEntry,
    underlyingPriceExit: input.underlyingPriceExit,
    underlyingPriceCurrent: input.underlyingPriceCurrent,
    capitalAtRisk: input.capitalAtRisk,
    status: mapStatus(input.status),
  };

  const { metrics } = calculateOptionLeg(legInput);

  return {
    premiumValuePerContract: metrics.premiumValuePerContract,
    totalEntryCost: metrics.totalEntryCost,
    totalExitValue: metrics.totalExitValue,
    realizedPnl: metrics.realizedPnl,
    unrealizedPnl: metrics.unrealizedPnl,
    percentReturn: metrics.returnPct,
    percentReturnLabel: metrics.returnBasisLabel,
    breakEven: metrics.breakEvenPrice,
    maxProfit: metrics.maxProfit,
    maxProfitLabel: metrics.maxProfitLabel,
    maxLoss: metrics.maxLoss,
    maxLossLabel: metrics.maxLossLabel,
    intrinsicValue: metrics.intrinsicValuePerShare,
    extrinsicValue: metrics.extrinsicValuePerShare,
    notionalExposure: metrics.currentNotional ?? metrics.entryNotional,
    distanceToStrikePct: metrics.distanceToStrikePct,
    moneyness: metrics.moneyness,
    daysToExpiration: metrics.daysToExpirationAtEntry,
    daysRemaining: metrics.daysRemaining,
    totalFees: metrics.totalFees,
  };
}

// Re-export display helpers from new engine
export { getPositionLabel, getMoneynessBadge } from "./options/analytics";

/**
 * Legacy validation — delegates to new engine.
 */
export function validateOptionsInput(input: Partial<OptionsTradeInput>): string[] {
  const { validateOptionLeg } = require("./options/validation");
  const mapped: any = {
    optionType: input.optionType,
    positionSide: input.positionDirection,
    strikePrice: input.strikePrice,
    entryPremium: input.entryPremium,
    exitPremium: input.exitPremium,
    currentPremium: input.currentPremium,
    contracts: input.numContracts,
    multiplier: input.contractMultiplier,
    entryFees: input.entryFees,
    exitFees: input.exitFees,
    status: input.status ? mapStatus(input.status) : undefined,
  };
  const result = validateOptionLeg(mapped);
  return result.errors;
}
