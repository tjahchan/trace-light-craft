/**
 * Options CSV Import — Tests
 */

import { describe, it, expect } from "vitest";
import { parseOptionSymbol } from "../options/csv-import/symbol-parser";
import { normalizeAction } from "../options/csv-import/action-normalizer";
import { normalizePremium } from "../options/csv-import/premium-normalizer";
import { mapCsvHeaders } from "../options/csv-import/header-mapper";
import { parseCSVText, runImportPipeline } from "../options/csv-import";

// ─── Symbol Parser ────────────────────────────────────────────

describe("parseOptionSymbol", () => {
  it("parses OCC format AAPL240621C00200000", () => {
    const r = parseOptionSymbol("AAPL240621C00200000");
    expect(r).not.toBeNull();
    expect(r!.underlyingTicker).toBe("AAPL");
    expect(r!.expirationDate).toBe("2024-06-21");
    expect(r!.optionType).toBe("call");
    expect(r!.strikePrice).toBe(200);
  });

  it("parses OCC format NVDA240719P00120000", () => {
    const r = parseOptionSymbol("NVDA240719P00120000");
    expect(r).not.toBeNull();
    expect(r!.underlyingTicker).toBe("NVDA");
    expect(r!.optionType).toBe("put");
    expect(r!.strikePrice).toBe(120);
  });

  it("parses underscore format META_2024-06-21_500_C", () => {
    const r = parseOptionSymbol("META_2024-06-21_500_C");
    expect(r).not.toBeNull();
    expect(r!.underlyingTicker).toBe("META");
    expect(r!.strikePrice).toBe(500);
    expect(r!.optionType).toBe("call");
  });

  it("parses spaced format: TSLA 06/21/2024 200 P", () => {
    const r = parseOptionSymbol("TSLA 06/21/2024 200 P");
    expect(r).not.toBeNull();
    expect(r!.underlyingTicker).toBe("TSLA");
    expect(r!.optionType).toBe("put");
    expect(r!.strikePrice).toBe(200);
  });

  it("returns null for plain stock symbol", () => {
    expect(parseOptionSymbol("AAPL")).toBeNull();
  });
});

// ─── Action Normalizer ───────────────────────────────────────

describe("normalizeAction", () => {
  it("normalizes BTO correctly", () => {
    const r = normalizeAction("BTO");
    expect(r).not.toBeNull();
    expect(r!.positionSide).toBe("long");
    expect(r!.rowEffect).toBe("entry");
    expect(r!.confidence).toBe("high");
  });

  it("normalizes Sell to Close correctly", () => {
    const r = normalizeAction("Sell to Close");
    expect(r).not.toBeNull();
    expect(r!.positionSide).toBe("long");
    expect(r!.rowEffect).toBe("exit");
  });

  it("normalizes Buy to Close correctly", () => {
    const r = normalizeAction("Buy to Close");
    expect(r).not.toBeNull();
    expect(r!.positionSide).toBe("short");
    expect(r!.rowEffect).toBe("exit");
  });

  it("handles separate side + open/close columns", () => {
    const r = normalizeAction(null, "Buy", "Open");
    expect(r).not.toBeNull();
    expect(r!.positionSide).toBe("long");
    expect(r!.rowEffect).toBe("entry");
  });

  it("returns null for empty input", () => {
    expect(normalizeAction(null, null, null)).toBeNull();
  });
});

// ─── Premium Normalizer ──────────────────────────────────────

describe("normalizePremium", () => {
  it("treats direct price as per-share", () => {
    const r = normalizePremium("2.35", null, 2, 100);
    expect(r).not.toBeNull();
    expect(r!.premiumPerShare).toBe(2.35);
    expect(r!.sourceFormat).toBe("per_share");
  });

  it("normalizes from gross total", () => {
    const r = normalizePremium(null, "420", 3, 100);
    expect(r).not.toBeNull();
    expect(r!.premiumPerShare).toBeCloseTo(1.4, 2);
    expect(r!.sourceFormat).toBe("gross_total");
  });

  it("handles dollar signs and commas", () => {
    const r = normalizePremium("$1,234.56", null, 1, 100);
    expect(r).not.toBeNull();
    expect(r!.premiumPerShare).toBeCloseTo(1234.56);
  });

  it("handles parentheses as negative", () => {
    const r = normalizePremium("(470.00)", null, 2, 100);
    expect(r).not.toBeNull();
    expect(r!.premiumPerShare).toBeCloseTo(2.35, 2);
  });
});

// ─── Header Mapper ────────────────────────────────────────────

describe("mapCsvHeaders", () => {
  it("maps common option headers", () => {
    const headers = ["Symbol", "Action", "Qty", "Price", "Commission", "Trade Date"];
    const mappings = mapCsvHeaders(headers, []);
    const mapped = mappings.map(m => m.mappedField);
    expect(mapped).toContain("symbol");
    expect(mapped).toContain("action");
    expect(mapped).toContain("contracts");
    expect(mapped).toContain("price");
    expect(mapped).toContain("fees");
  });
});

// ─── Full Pipeline ────────────────────────────────────────────

describe("runImportPipeline", () => {
  it("CASE 1: parses OCC symbol BTO row", () => {
    const headers = ["Symbol", "Action", "Qty", "Price", "Commission", "Trade Date"];
    const rows = [["AAPL240621C00200000", "BTO", "2", "2.35", "1.30", "2024-06-01 10:15:00"]];
    const { groupedTrades } = runImportPipeline(headers, rows);
    expect(groupedTrades.length).toBe(1);
    const t = groupedTrades[0];
    expect(t.underlyingTicker).toBe("AAPL");
    expect(t.optionType).toBe("call");
    expect(t.strikePrice).toBe(200);
    expect(t.positionSide).toBe("long");
    expect(t.contracts).toBe(2);
    expect(t.entryPremium).toBeCloseTo(2.35);
  });

  it("CASE 2: normalizes premium from net amount for STO", () => {
    const headers = ["Symbol", "Action", "Contracts", "Net Amount", "Fees"];
    const rows = [["TSLA 06/21/2024 200 P", "STO", "3", "420", "3.00"]];
    const { groupedTrades } = runImportPipeline(headers, rows);
    expect(groupedTrades.length).toBe(1);
    const t = groupedTrades[0];
    expect(t.positionSide).toBe("short");
    expect(t.optionType).toBe("put");
  });

  it("CASE 3: explicit columns Sell to Close", () => {
    const headers = ["Underlying", "Type", "Strike", "Expiration", "Side", "Qty", "Avg Price"];
    const rows = [["SPY", "Call", "540", "2024-06-21", "Sell to Close", "1", "4.85"]];
    const { groupedTrades } = runImportPipeline(headers, rows);
    expect(groupedTrades.length).toBe(1);
  });

  it("CASE 8: duplicate detection", () => {
    const headers = ["Symbol", "Action", "Qty", "Price", "Trade Date"];
    const row = ["AAPL240621C00200000", "BTO", "2", "2.35", "2024-06-01"];
    const { report } = runImportPipeline(headers, [row, row]);
    expect(report.duplicateCount).toBe(1);
  });
});
