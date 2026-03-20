/**
 * Options Trade Calculation Engine
 * All formulas treat premium as per-share values (standard options quoting).
 */

export type OptionType = "call" | "put";
export type PositionDirection = "long" | "short";
export type OptionStatus = "open" | "closed" | "expired" | "assigned" | "exercised";
export type Moneyness = "ITM" | "ATM" | "OTM";

export interface OptionsTradeInput {
  optionType: OptionType;
  positionDirection: PositionDirection;
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
  status: OptionStatus;
}

export interface OptionsCalculations {
  premiumValuePerContract: number;
  totalEntryCost: number; // positive = outflow for long, negative = credit for short
  totalExitValue: number | null;
  realizedPnl: number | null;
  unrealizedPnl: number | null;
  percentReturn: number | null;
  percentReturnLabel: string;
  breakEven: number;
  maxProfit: number | null; // null = unlimited
  maxProfitLabel: string;
  maxLoss: number | null; // null = unlimited
  maxLossLabel: string;
  intrinsicValue: number | null;
  extrinsicValue: number | null;
  notionalExposure: number | null;
  distanceToStrikePct: number | null;
  moneyness: Moneyness | null;
  daysToExpiration: number | null;
  daysRemaining: number | null;
  totalFees: number;
}

/**
 * Core calculation engine for options trades.
 */
export function calculateOptions(input: OptionsTradeInput): OptionsCalculations {
  const {
    optionType,
    positionDirection,
    strikePrice,
    entryPremium,
    exitPremium,
    currentPremium,
    numContracts,
    contractMultiplier,
    entryFees,
    exitFees,
    underlyingPriceEntry,
    underlyingPriceCurrent,
    expirationDate,
    entryDate,
    capitalAtRisk,
    status,
  } = input;

  const isLong = positionDirection === "long";
  const isCall = optionType === "call";
  const totalFees = (entryFees || 0) + (exitFees || 0);
  const mult = contractMultiplier || 100;

  // Premium value per contract
  const premiumValuePerContract = entryPremium * mult;

  // Total entry cost / credit
  const rawEntryCost = entryPremium * mult * numContracts;
  const totalEntryCost = isLong
    ? rawEntryCost + (entryFees || 0)
    : rawEntryCost - (entryFees || 0); // credit received net of fees

  // Total exit value
  let totalExitValue: number | null = null;
  const effectiveExitPremium = status === "expired" ? 0 : exitPremium;
  
  if (effectiveExitPremium != null) {
    const rawExitValue = effectiveExitPremium * mult * numContracts;
    totalExitValue = isLong
      ? rawExitValue - (exitFees || 0)
      : rawExitValue + (exitFees || 0);
  }

  // Realized PnL (only for closed/expired trades)
  let realizedPnl: number | null = null;
  if (status !== "open" && effectiveExitPremium != null) {
    if (isLong) {
      realizedPnl = ((effectiveExitPremium - entryPremium) * mult * numContracts) - totalFees;
    } else {
      realizedPnl = ((entryPremium - effectiveExitPremium) * mult * numContracts) - totalFees;
    }
  }

  // Unrealized PnL (for open trades)
  let unrealizedPnl: number | null = null;
  if (status === "open" && currentPremium != null) {
    if (isLong) {
      unrealizedPnl = ((currentPremium - entryPremium) * mult * numContracts) - (entryFees || 0);
    } else {
      unrealizedPnl = ((entryPremium - currentPremium) * mult * numContracts) - (entryFees || 0);
    }
  }

  // Percent return
  let percentReturn: number | null = null;
  let percentReturnLabel = "Return %";
  const pnlValue = realizedPnl ?? unrealizedPnl;
  if (pnlValue != null) {
    if (isLong) {
      const basis = totalEntryCost;
      if (basis > 0) {
        percentReturn = (pnlValue / basis) * 100;
      }
    } else {
      if (capitalAtRisk && capitalAtRisk > 0) {
        percentReturn = (pnlValue / capitalAtRisk) * 100;
        percentReturnLabel = "Return on Capital";
      } else {
        // Fallback to premium collected basis
        const premiumBasis = rawEntryCost;
        if (premiumBasis > 0) {
          percentReturn = (pnlValue / premiumBasis) * 100;
          percentReturnLabel = "Return on Premium (approx.)";
        }
      }
    }
  }

  // Break-even at expiration
  let breakEven: number;
  if (isCall) {
    breakEven = strikePrice + entryPremium;
  } else {
    breakEven = strikePrice - entryPremium;
  }

  // Max profit / max loss
  let maxProfit: number | null = null;
  let maxProfitLabel = "";
  let maxLoss: number | null = null;
  let maxLossLabel = "";

  if (isLong && isCall) {
    maxLoss = totalEntryCost;
    maxLossLabel = `$${maxLoss.toFixed(2)}`;
    maxProfit = null;
    maxProfitLabel = "Unlimited";
  } else if (isLong && !isCall) {
    maxLoss = totalEntryCost;
    maxLossLabel = `$${maxLoss.toFixed(2)}`;
    maxProfit = ((strikePrice - entryPremium) * mult * numContracts) - totalFees;
    maxProfitLabel = maxProfit > 0 ? `$${maxProfit.toFixed(2)}` : "$0.00";
  } else if (!isLong && isCall) {
    maxProfit = rawEntryCost - totalFees;
    maxProfitLabel = `$${maxProfit.toFixed(2)}`;
    maxLoss = null;
    maxLossLabel = "Unlimited";
  } else {
    // Short put
    maxProfit = rawEntryCost - totalFees;
    maxProfitLabel = `$${maxProfit.toFixed(2)}`;
    maxLoss = ((strikePrice - entryPremium) * mult * numContracts) + totalFees;
    maxLossLabel = `$${maxLoss.toFixed(2)}`;
  }

  // Intrinsic & extrinsic value
  let intrinsicValue: number | null = null;
  let extrinsicValue: number | null = null;
  const underlyingNow = underlyingPriceCurrent ?? underlyingPriceEntry;
  if (underlyingNow != null && strikePrice > 0) {
    if (isCall) {
      intrinsicValue = Math.max(underlyingNow - strikePrice, 0);
    } else {
      intrinsicValue = Math.max(strikePrice - underlyingNow, 0);
    }
    const marketPrice = currentPremium ?? (status !== "open" ? effectiveExitPremium : entryPremium);
    if (marketPrice != null) {
      extrinsicValue = marketPrice - intrinsicValue;
    }
  }

  // Notional exposure
  let notionalExposure: number | null = null;
  if (underlyingNow != null) {
    notionalExposure = underlyingNow * mult * numContracts;
  }

  // Distance to strike
  let distanceToStrikePct: number | null = null;
  if (underlyingNow != null && underlyingNow > 0) {
    if (isCall) {
      distanceToStrikePct = ((strikePrice - underlyingNow) / underlyingNow) * 100;
    } else {
      distanceToStrikePct = ((underlyingNow - strikePrice) / underlyingNow) * 100;
    }
  }

  // Moneyness
  let moneyness: Moneyness | null = null;
  if (underlyingNow != null && strikePrice > 0) {
    const threshold = underlyingNow * 0.005; // 0.5% ATM zone
    if (isCall) {
      if (underlyingNow > strikePrice + threshold) moneyness = "ITM";
      else if (underlyingNow < strikePrice - threshold) moneyness = "OTM";
      else moneyness = "ATM";
    } else {
      if (underlyingNow < strikePrice - threshold) moneyness = "ITM";
      else if (underlyingNow > strikePrice + threshold) moneyness = "OTM";
      else moneyness = "ATM";
    }
  }

  // Days to expiration
  let daysToExpiration: number | null = null;
  let daysRemaining: number | null = null;
  if (expirationDate) {
    const expiry = new Date(expirationDate);
    if (entryDate) {
      const entry = new Date(entryDate);
      daysToExpiration = Math.max(0, Math.ceil((expiry.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24)));
    }
    const now = new Date();
    daysRemaining = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return {
    premiumValuePerContract,
    totalEntryCost,
    totalExitValue,
    realizedPnl,
    unrealizedPnl,
    percentReturn,
    percentReturnLabel,
    breakEven,
    maxProfit,
    maxProfitLabel,
    maxLoss,
    maxLossLabel,
    intrinsicValue,
    extrinsicValue,
    notionalExposure,
    distanceToStrikePct,
    moneyness,
    daysToExpiration,
    daysRemaining,
    totalFees,
  };
}

/**
 * Format position label e.g. "Long Call", "Short Put"
 */
export function getPositionLabel(direction: PositionDirection, optionType: OptionType): string {
  const d = direction === "long" ? "Long" : "Short";
  const o = optionType === "call" ? "Call" : "Put";
  return `${d} ${o}`;
}

/**
 * Get moneyness badge color
 */
export function getMoneynessBadge(m: Moneyness | null): { label: string; className: string } {
  switch (m) {
    case "ITM": return { label: "ITM", className: "bg-profit/15 text-profit border-profit/25" };
    case "ATM": return { label: "ATM", className: "bg-amber-500/15 text-amber-400 border-amber-500/25" };
    case "OTM": return { label: "OTM", className: "bg-loss/15 text-loss border-loss/25" };
    default: return { label: "—", className: "bg-white/5 text-muted-foreground border-white/10" };
  }
}

/**
 * Validate options trade inputs. Returns array of error messages.
 */
export function validateOptionsInput(input: Partial<OptionsTradeInput>): string[] {
  const errors: string[] = [];
  if (!input.optionType) errors.push("Option type (Call/Put) is required");
  if (!input.positionDirection) errors.push("Position direction (Long/Short) is required");
  if (!input.strikePrice || input.strikePrice <= 0) errors.push("Strike price must be positive");
  if (!input.entryPremium || input.entryPremium < 0) errors.push("Entry premium cannot be negative");
  if (!input.numContracts || input.numContracts <= 0) errors.push("Number of contracts must be positive");
  if (input.contractMultiplier != null && input.contractMultiplier <= 0) errors.push("Contract multiplier must be positive");
  if (input.exitPremium != null && input.exitPremium < 0) errors.push("Exit premium cannot be negative");
  if (input.status === "closed" && input.exitPremium == null) errors.push("Exit premium is required for closed trades");
  if (input.expirationDate) {
    const exp = new Date(input.expirationDate);
    if (isNaN(exp.getTime())) errors.push("Expiration date is invalid");
  }
  if (input.entryDate && input.expirationDate) {
    if (new Date(input.entryDate) > new Date(input.expirationDate)) {
      // Warning, not blocking
    }
  }
  return errors;
}
