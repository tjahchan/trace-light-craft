import { describe, it, expect } from "vitest";
import {
  calculateOptionLeg,
  calculateTradeAggregates,
  deriveBreakEven,
  deriveMoneyness,
  deriveIntrinsicValue,
  deriveMaxProfitLoss,
  formatCurrency,
  roundCurrency,
} from "@/lib/options/calculations";
import { validateOptionLeg, canCalculate } from "@/lib/options/validation";
import {
  dteBucket,
  deltaBucket,
  ivBucket,
  pnlCategory,
  isWinner,
  computeOptionsSummary,
} from "@/lib/options/analytics";
import type { OptionLegInput } from "@/lib/options/types";

// ─── Helpers ──────────────────────────────────────────────────

function makeLeg(overrides: Partial<OptionLegInput> = {}): OptionLegInput {
  return {
    optionType: "call",
    positionSide: "long",
    strikePrice: 150,
    expirationDate: "2026-04-17",
    multiplier: 100,
    contracts: 1,
    entryPremium: 2.35,
    exitPremium: null,
    currentPremium: null,
    entryDateTime: "2026-03-20T12:00:00Z",
    exitDateTime: null,
    entryFees: 0.65,
    exitFees: 0,
    status: "open",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("Options Engine — Calculations", () => {
  // 1. Long call winner
  it("calculates long call winner correctly", () => {
    const leg = makeLeg({
      entryPremium: 2.35,
      exitPremium: 4.50,
      entryFees: 0.65,
      exitFees: 0.65,
      contracts: 5,
      status: "closed",
    });
    const { metrics } = calculateOptionLeg(leg);

    expect(metrics.premiumValuePerContract).toBe(235);
    expect(metrics.totalPremiumValue).toBe(1175); // 2.35 * 100 * 5
    // realized = (4.50 - 2.35) * 100 * 5 - 1.30 = 1075 - 1.30 = 1073.70
    expect(roundCurrency(metrics.realizedPnl!)).toBe(1073.70);
    expect(metrics.unrealizedPnl).toBeNull();
    expect(metrics.returnPct).not.toBeNull();
  });

  // 2. Long call loser
  it("calculates long call loser correctly", () => {
    const leg = makeLeg({
      entryPremium: 5.00,
      exitPremium: 1.20,
      entryFees: 1.00,
      exitFees: 1.00,
      contracts: 2,
      status: "closed",
    });
    const { metrics } = calculateOptionLeg(leg);

    // realized = (1.20 - 5.00) * 100 * 2 - 2.00 = -760 - 2 = -762
    expect(roundCurrency(metrics.realizedPnl!)).toBe(-762.00);
  });

  // 3. Long put winner
  it("calculates long put winner correctly", () => {
    const leg = makeLeg({
      optionType: "put",
      strikePrice: 100,
      entryPremium: 3.00,
      exitPremium: 8.00,
      entryFees: 0,
      exitFees: 0,
      contracts: 1,
      status: "closed",
    });
    const { metrics } = calculateOptionLeg(leg);

    // (8-3)*100*1 - 0 = 500
    expect(metrics.realizedPnl).toBe(500);
    expect(metrics.breakEvenPrice).toBe(97); // 100 - 3
  });

  // 4. Short put expires worthless
  it("calculates short put expired worthless correctly", () => {
    const leg = makeLeg({
      optionType: "put",
      positionSide: "short",
      strikePrice: 50,
      entryPremium: 1.50,
      exitPremium: null,
      entryFees: 0.50,
      exitFees: 0,
      contracts: 10,
      status: "expired_worthless",
    });
    const { metrics } = calculateOptionLeg(leg);

    // Short expired worthless: (1.50 - 0) * 100 * 10 - 0.50 = 1500 - 0.50 = 1499.50
    expect(roundCurrency(metrics.realizedPnl!)).toBe(1499.50);
  });

  // 5. Short call buyback at loss
  it("calculates short call buyback at loss", () => {
    const leg = makeLeg({
      optionType: "call",
      positionSide: "short",
      strikePrice: 200,
      entryPremium: 3.00,
      exitPremium: 7.00,
      entryFees: 0.65,
      exitFees: 0.65,
      contracts: 3,
      status: "closed",
    });
    const { metrics } = calculateOptionLeg(leg);

    // Short: (3.00 - 7.00) * 100 * 3 - 1.30 = -1200 - 1.30 = -1201.30
    expect(roundCurrency(metrics.realizedPnl!)).toBe(-1201.30);
  });

  // 6. Open long call with unrealized gain
  it("calculates unrealized gain for open long call", () => {
    const leg = makeLeg({
      entryPremium: 2.00,
      currentPremium: 3.50,
      entryFees: 1.00,
      contracts: 2,
      status: "open",
    });
    const { metrics } = calculateOptionLeg(leg);

    // (3.50 - 2.00) * 100 * 2 - 1.00 = 300 - 1 = 299
    expect(metrics.unrealizedPnl).toBe(299);
    expect(metrics.realizedPnl).toBeNull();
  });

  // 7. Open short put with unrealized loss
  it("calculates unrealized loss for open short put", () => {
    const leg = makeLeg({
      optionType: "put",
      positionSide: "short",
      strikePrice: 100,
      entryPremium: 2.00,
      currentPremium: 5.00,
      entryFees: 0,
      contracts: 1,
      status: "open",
    });
    const { metrics } = calculateOptionLeg(leg);

    // Short: (2.00 - 5.00) * 100 * 1 - 0 = -300
    expect(metrics.unrealizedPnl).toBe(-300);
  });

  // 8. Expired worthless long option
  it("calculates expired worthless long option", () => {
    const leg = makeLeg({
      entryPremium: 4.00,
      entryFees: 1.00,
      exitFees: 0,
      contracts: 3,
      status: "expired_worthless",
    });
    const { metrics } = calculateOptionLeg(leg);

    // Long expired: (0 - 4.00) * 100 * 3 - 1.00 = -1200 - 1 = -1201
    expect(metrics.realizedPnl).toBe(-1201);
  });

  // 9. Missing current premium on open trade
  it("warns when no current premium on open trade", () => {
    const leg = makeLeg({ status: "open", currentPremium: null });
    const { metrics, warnings } = calculateOptionLeg(leg);

    expect(metrics.unrealizedPnl).toBeNull();
    expect(warnings.some((w) => w.includes("current premium"))).toBe(true);
  });

  // 10. Unusual multiplier
  it("handles unusual multiplier", () => {
    const leg = makeLeg({
      multiplier: 10,
      entryPremium: 5.00,
      exitPremium: 8.00,
      entryFees: 0,
      exitFees: 0,
      contracts: 1,
      status: "closed",
    });
    const { metrics } = calculateOptionLeg(leg);

    expect(metrics.premiumValuePerContract).toBe(50); // 5 * 10
    expect(metrics.realizedPnl).toBe(30); // (8-5)*10*1
  });

  // 11. Large contract size
  it("handles large contract size", () => {
    const leg = makeLeg({
      entryPremium: 1.00,
      exitPremium: 2.00,
      contracts: 500,
      entryFees: 50,
      exitFees: 50,
      status: "closed",
    });
    const { metrics } = calculateOptionLeg(leg);

    // (2-1)*100*500 - 100 = 50000 - 100 = 49900
    expect(metrics.realizedPnl).toBe(49900);
  });

  // 12. Negative extrinsic warning
  it("warns on negative extrinsic value", () => {
    const leg = makeLeg({
      strikePrice: 150,
      entryPremium: 1.00,
      currentPremium: 1.00,
      underlyingPriceCurrent: 160, // deep ITM, intrinsic = 10, extrinsic = 1-10 = -9
      status: "open",
    });
    const { warnings } = calculateOptionLeg(leg);

    expect(warnings.some((w) => w.includes("Negative extrinsic"))).toBe(true);
  });

  // 13. Closed trade with fees on both sides
  it("accounts for entry and exit fees", () => {
    const leg = makeLeg({
      entryPremium: 3.00,
      exitPremium: 5.00,
      entryFees: 2.50,
      exitFees: 2.50,
      contracts: 1,
      status: "closed",
    });
    const { metrics } = calculateOptionLeg(leg);

    // (5-3)*100*1 - 5 = 200 - 5 = 195
    expect(metrics.realizedPnl).toBe(195);
    expect(metrics.totalFees).toBe(5);
  });

  // 14. Short trade with capitalAtRisk return basis
  it("uses capitalAtRisk for short return %", () => {
    const leg = makeLeg({
      positionSide: "short",
      entryPremium: 2.00,
      exitPremium: 0.50,
      entryFees: 0,
      exitFees: 0,
      contracts: 1,
      capitalAtRisk: 5000,
      status: "closed",
    });
    const { metrics, warnings } = calculateOptionLeg(leg);

    // pnl = (2-0.5)*100*1 = 150
    expect(metrics.realizedPnl).toBe(150);
    // return = 150/5000 * 100 = 3%
    expect(roundCurrency(metrics.returnPct!)).toBe(3);
    expect(metrics.returnBasis).toBe("capital_at_risk");
    expect(warnings.some((w) => w.includes("premium collected"))).toBe(false);
  });

  // 15. Short trade fallback to premium collected
  it("falls back to premium collected basis for short trades", () => {
    const leg = makeLeg({
      positionSide: "short",
      entryPremium: 2.00,
      exitPremium: 1.00,
      entryFees: 0,
      exitFees: 0,
      contracts: 1,
      status: "closed",
    });
    const { metrics, warnings } = calculateOptionLeg(leg);

    expect(metrics.returnBasis).toBe("premium_collected");
    expect(warnings.some((w) => w.includes("premium collected"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Break-even
// ═══════════════════════════════════════════════════════════════

describe("Break-even", () => {
  it("call: strike + premium", () => {
    expect(deriveBreakEven("call", 150, 2.35)).toBe(152.35);
  });

  it("put: strike - premium", () => {
    expect(deriveBreakEven("put", 100, 3.00)).toBe(97);
  });
});

// ═══════════════════════════════════════════════════════════════
// Moneyness
// ═══════════════════════════════════════════════════════════════

describe("Moneyness", () => {
  it("call ITM", () => expect(deriveMoneyness("call", 100, 110)).toBe("ITM"));
  it("call OTM", () => expect(deriveMoneyness("call", 100, 90)).toBe("OTM"));
  it("call ATM", () => expect(deriveMoneyness("call", 100, 100)).toBe("ATM"));
  it("put ITM", () => expect(deriveMoneyness("put", 100, 90)).toBe("ITM"));
  it("put OTM", () => expect(deriveMoneyness("put", 100, 110)).toBe("OTM"));
  it("put ATM", () => expect(deriveMoneyness("put", 100, 100)).toBe("ATM"));
  it("null underlying", () => expect(deriveMoneyness("call", 100, null)).toBeNull());
});

// ═══════════════════════════════════════════════════════════════
// Intrinsic Value
// ═══════════════════════════════════════════════════════════════

describe("Intrinsic Value", () => {
  it("call ITM", () => expect(deriveIntrinsicValue("call", 100, 115)).toBe(15));
  it("call OTM", () => expect(deriveIntrinsicValue("call", 100, 90)).toBe(0));
  it("put ITM", () => expect(deriveIntrinsicValue("put", 100, 85)).toBe(15));
  it("put OTM", () => expect(deriveIntrinsicValue("put", 100, 110)).toBe(0));
});

// ═══════════════════════════════════════════════════════════════
// Max Profit / Loss
// ═══════════════════════════════════════════════════════════════

describe("Max Profit / Loss", () => {
  it("long call: limited loss, unlimited profit", () => {
    const r = deriveMaxProfitLoss("call", "long", 150, 2.35, 100, 1, 1.30);
    expect(r.maxProfit).toBeNull();
    expect(r.maxLoss).toBe(236.30); // 235 + 1.30
  });

  it("short call: limited profit, unlimited loss", () => {
    const r = deriveMaxProfitLoss("call", "short", 150, 2.35, 100, 1, 1.30);
    expect(r.maxLoss).toBeNull();
    expect(roundCurrency(r.maxProfit!)).toBe(233.70); // 235 - 1.30
  });

  it("long put: both limited", () => {
    const r = deriveMaxProfitLoss("put", "long", 100, 3, 100, 1, 0);
    expect(r.maxLoss).toBe(300);
    expect(r.maxProfit).toBe(9700); // (100-3)*100 - 0
  });

  it("short put: both limited", () => {
    const r = deriveMaxProfitLoss("put", "short", 100, 3, 100, 1, 0);
    expect(r.maxProfit).toBe(300);
    expect(r.maxLoss).toBe(9700); // (100-3)*100 + 0
  });
});

// ═══════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════

describe("Validation", () => {
  it("valid input passes", () => {
    const r = validateOptionLeg(makeLeg());
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("missing option type fails", () => {
    const r = validateOptionLeg({ positionSide: "long", strikePrice: 100 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("Option type"))).toBe(true);
  });

  it("negative strike fails", () => {
    const r = validateOptionLeg(makeLeg({ strikePrice: -5 }));
    expect(r.valid).toBe(false);
  });

  it("closed without exit premium fails", () => {
    const r = validateOptionLeg(makeLeg({ status: "closed", exitPremium: null }));
    expect(r.errors.some((e) => e.includes("Exit premium"))).toBe(true);
  });

  it("open without current premium warns", () => {
    const r = validateOptionLeg(makeLeg({ status: "open", currentPremium: null }));
    expect(r.warnings.some((w) => w.includes("current premium"))).toBe(true);
  });

  it("canCalculate returns true for valid input", () => {
    expect(canCalculate(makeLeg())).toBe(true);
  });

  it("canCalculate returns false when missing strike", () => {
    expect(canCalculate({ optionType: "call", positionSide: "long" })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════════════════

describe("Analytics helpers", () => {
  it("isWinner", () => {
    expect(isWinner(100)).toBe(true);
    expect(isWinner(-50)).toBe(false);
    expect(isWinner(null)).toBeNull();
  });

  it("dteBucket", () => {
    expect(dteBucket(5)).toBe("0-7");
    expect(dteBucket(10)).toBe("8-14");
    expect(dteBucket(25)).toBe("15-30");
    expect(dteBucket(45)).toBe("31-60");
    expect(dteBucket(80)).toBe("61-90");
    expect(dteBucket(120)).toBe("90+");
    expect(dteBucket(null)).toBeNull();
  });

  it("deltaBucket", () => {
    expect(deltaBucket(0.05)).toBe("0-0.15");
    expect(deltaBucket(0.25)).toBe("0.15-0.30");
    expect(deltaBucket(0.45)).toBe("0.30-0.50");
    expect(deltaBucket(-0.65)).toBe("0.50-0.70");
    expect(deltaBucket(0.9)).toBe("0.70-1.00");
  });

  it("ivBucket", () => {
    expect(ivBucket(15)).toBe("low");
    expect(ivBucket(30)).toBe("medium");
    expect(ivBucket(50)).toBe("high");
    expect(ivBucket(80)).toBe("extreme");
  });

  it("pnlCategory", () => {
    expect(pnlCategory(250, 1000)).toBe("big_win");
    expect(pnlCategory(50, 1000)).toBe("small_win");
    expect(pnlCategory(-20, 1000)).toBe("breakeven");
    expect(pnlCategory(-100, 1000)).toBe("small_loss");
    expect(pnlCategory(-300, 1000)).toBe("big_loss");
  });
});

// ═══════════════════════════════════════════════════════════════
// Trade Aggregation
// ═══════════════════════════════════════════════════════════════

describe("Trade Aggregation", () => {
  it("aggregates single leg correctly", () => {
    const leg = makeLeg({
      exitPremium: 5.00,
      entryFees: 1,
      exitFees: 1,
      contracts: 2,
      status: "closed",
    });
    const agg = calculateTradeAggregates([leg]);

    expect(agg.totalContracts).toBe(2);
    expect(agg.netFees).toBe(2);
    expect(agg.totalRealizedPnl).not.toBeNull();
  });

  it("handles unlimited risk in aggregation", () => {
    const shortCall = makeLeg({
      positionSide: "short",
      exitPremium: 1.00,
      status: "closed",
    });
    const agg = calculateTradeAggregates([shortCall]);
    expect(agg.totalMaxRisk).toBeNull(); // short call = unlimited
  });
});
