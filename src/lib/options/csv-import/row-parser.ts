/**
 * Options CSV Import — Row Parser
 *
 * Parses individual CSV rows into structured ParsedOptionsRow objects
 * using the column mappings, symbol parser, action normalizer, and premium normalizer.
 */

import type { ColumnMapping, ParsedOptionsRow, OptionsField, NormalizedAction } from "./types";
import type { OptionType } from "../types";
import { parseOptionSymbol } from "./symbol-parser";
import { normalizeAction } from "./action-normalizer";
import { normalizePremium, cleanNumeric } from "./premium-normalizer";

function getField(row: string[], mappings: ColumnMapping[], field: OptionsField): string | null {
  const mapping = mappings.find(m => m.mappedField === field);
  if (!mapping) return null;
  const val = row[mapping.csvColumnIndex];
  return val?.trim() || null;
}

function parseDate(dateStr: string | null, timeStr?: string | null): string | null {
  if (!dateStr) return null;
  let combined = dateStr;
  if (timeStr) combined = `${dateStr} ${timeStr}`;

  // Try ISO format
  const d = new Date(combined);
  if (!isNaN(d.getTime())) return d.toISOString();

  // Try MM/DD/YYYY
  const parts = combined.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (parts) {
    const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
    const tryDate = new Date(`${year}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`);
    if (!isNaN(tryDate.getTime())) return tryDate.toISOString();
  }

  return null;
}

function parseOptionType(value: string | null): OptionType | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  if (lower === "call" || lower === "c") return "call";
  if (lower === "put" || lower === "p") return "put";
  return null;
}

export function parseRow(
  row: string[],
  rowIndex: number,
  headers: string[],
  mappings: ColumnMapping[],
): ParsedOptionsRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Build raw record
  const raw: Record<string, string> = {};
  headers.forEach((h, i) => { raw[h] = row[i] || ""; });

  // ─── Symbol parsing
  const symbolRaw = getField(row, mappings, "symbol");
  const symbolParseResult = symbolRaw ? parseOptionSymbol(symbolRaw) : null;

  // ─── Underlying ticker
  let underlyingTicker = getField(row, mappings, "underlying");
  if (!underlyingTicker && symbolParseResult) {
    underlyingTicker = symbolParseResult.underlyingTicker;
  }

  // ─── Option type
  let optionType = parseOptionType(getField(row, mappings, "optionType"));
  if (!optionType && symbolParseResult) {
    optionType = symbolParseResult.optionType;
  }
  // Infer from description
  if (!optionType) {
    const desc = getField(row, mappings, "description");
    if (desc) {
      if (/\bcall\b/i.test(desc)) optionType = "call";
      else if (/\bput\b/i.test(desc)) optionType = "put";
    }
  }

  // ─── Strike
  let strikePrice: number | null = null;
  const strikeRaw = getField(row, mappings, "strike");
  if (strikeRaw) strikePrice = cleanNumeric(strikeRaw);
  if ((strikePrice == null || isNaN(strikePrice)) && symbolParseResult) {
    strikePrice = symbolParseResult.strikePrice;
  }
  if (strikePrice != null && isNaN(strikePrice)) strikePrice = null;

  // ─── Reconcile symbol parse vs explicit columns
  if (symbolParseResult && optionType && symbolParseResult.optionType !== optionType) {
    warnings.push(`Symbol parsed as ${symbolParseResult.optionType} but column says ${optionType}`);
  }
  if (symbolParseResult && strikePrice && Math.abs(symbolParseResult.strikePrice - strikePrice) > 0.01) {
    warnings.push(`Symbol parsed strike ${symbolParseResult.strikePrice} differs from column ${strikePrice}`);
  }

  // ─── Expiration
  let expirationDate: string | null = getField(row, mappings, "expiration");
  if (expirationDate) {
    const parsed = parseDate(expirationDate);
    expirationDate = parsed ? parsed.split("T")[0] : expirationDate;
  }
  if (!expirationDate && symbolParseResult) {
    expirationDate = symbolParseResult.expirationDate;
  }

  // ─── Contracts
  const contractsRaw = getField(row, mappings, "contracts");
  let contracts: number | null = contractsRaw ? Math.abs(Math.round(cleanNumeric(contractsRaw))) : null;
  if (contracts != null && (isNaN(contracts) || contracts <= 0)) contracts = null;

  // ─── Multiplier
  const multiplierRaw = getField(row, mappings, "multiplier");
  let multiplier = multiplierRaw ? cleanNumeric(multiplierRaw) : 100;
  if (isNaN(multiplier) || multiplier <= 0) {
    multiplier = 100;
    warnings.push("Multiplier defaulted to 100");
  }

  // ─── Action / Side
  const actionRaw = getField(row, mappings, "action");
  const sideRaw = getField(row, mappings, "side");
  const openCloseRaw = getField(row, mappings, "openClose");
  const quantitySign = contractsRaw ? cleanNumeric(contractsRaw) : null;

  const action: NormalizedAction | null = normalizeAction(
    actionRaw, sideRaw, openCloseRaw, quantitySign, null,
  );

  if (action && action.confidence === "low") {
    warnings.push(`Ambiguous action: "${action.rawAction}" — please verify`);
  }

  // ─── Premium
  const priceRaw = getField(row, mappings, "price");
  const totalAmountRaw = getField(row, mappings, "totalAmount");
  const premium = normalizePremium(priceRaw, totalAmountRaw, contracts || 1, multiplier);

  if (premium && premium.sourceFormat === "gross_total") {
    warnings.push("Premium normalized from gross amount — verify per-share value");
  }

  // ─── Fees
  const feesRaw = getField(row, mappings, "fees");
  const fees = feesRaw ? Math.abs(cleanNumeric(feesRaw)) : 0;

  // ─── DateTime
  const dateRaw = getField(row, mappings, "date");
  const timeRaw = getField(row, mappings, "time");
  const dateTimeRaw = getField(row, mappings, "dateTime");
  const dateTime = dateTimeRaw ? parseDate(dateTimeRaw) : parseDate(dateRaw, timeRaw);

  // ─── Greeks & IV
  const iv = parseOptionalNum(getField(row, mappings, "iv"));
  const delta = parseOptionalNum(getField(row, mappings, "delta"));
  const gamma = parseOptionalNum(getField(row, mappings, "gamma"));
  const theta = parseOptionalNum(getField(row, mappings, "theta"));
  const vega = parseOptionalNum(getField(row, mappings, "vega"));
  const rho = parseOptionalNum(getField(row, mappings, "rho"));

  // ─── Other fields
  const orderId = getField(row, mappings, "orderId");
  const underlyingPriceRaw = getField(row, mappings, "underlyingPrice");
  const underlyingPrice = underlyingPriceRaw ? cleanNumeric(underlyingPriceRaw) : null;
  const pnlRaw = getField(row, mappings, "pnl");
  const pnl = pnlRaw ? cleanNumeric(pnlRaw) : null;
  const description = getField(row, mappings, "description");

  // ─── Validation
  if (!underlyingTicker) errors.push("Missing underlying ticker");
  if (!optionType) errors.push("Missing option type (Call/Put)");
  if (strikePrice == null) errors.push("Missing strike price");
  if (!expirationDate) errors.push("Missing expiration date");
  if (contracts == null) errors.push("Missing contract quantity");
  if (!premium) errors.push("Missing premium / price");
  if (!action) errors.push("Missing action / side");
  if (!dateTime) warnings.push("Missing trade date/time");

  return {
    rowIndex,
    raw,
    underlyingTicker,
    optionType,
    strikePrice,
    expirationDate,
    action,
    contracts,
    multiplier,
    premium,
    fees,
    dateTime,
    iv,
    delta,
    gamma,
    theta,
    vega,
    rho,
    orderId,
    underlyingPrice,
    pnl,
    description,
    symbolParseResult,
    errors,
    warnings,
    isValid: errors.length === 0,
    isDuplicate: false,
  };
}

function parseOptionalNum(val: string | null): number | null {
  if (!val) return null;
  const n = cleanNumeric(val);
  return isNaN(n) ? null : n;
}
