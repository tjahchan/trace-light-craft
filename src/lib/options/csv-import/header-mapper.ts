/**
 * Options CSV Import — Fuzzy Header Mapping Engine
 */

import type { OptionsField, ColumnMapping, ConfidenceLevel } from "./types";
import { looksLikeOptionSymbol } from "./symbol-parser";

// Header aliases grouped by internal field
const HEADER_ALIASES: Record<OptionsField, string[]> = {
  symbol: ["symbol", "ticker", "option symbol", "option_symbol", "optionsymbol", "instrument", "contract"],
  underlying: ["underlying", "underlying symbol", "underlying_symbol", "root", "root symbol", "stock"],
  optionType: ["option type", "optiontype", "call/put", "put/call", "cp", "type", "call put", "callput"],
  strike: ["strike", "strike price", "strikepx", "strike_price", "strikeprice"],
  expiration: ["expiration", "expiry", "exp date", "expiration date", "exp_date", "maturity", "expiry date", "expires"],
  action: ["action", "instruction", "transaction type", "trans type", "trade type", "order action", "buy/sell", "b/s"],
  side: ["side", "direction", "position"],
  openClose: ["open/close", "open close", "openclose", "effect", "position effect"],
  contracts: ["qty", "quantity", "contracts", "filled quantity", "filled qty", "size", "lots", "num contracts", "# contracts"],
  price: ["price", "premium", "fill price", "avg price", "trade price", "net price", "average price", "exec price", "mark"],
  totalAmount: ["total", "total amount", "amount", "net amount", "net cash", "proceeds", "cost", "value", "net value"],
  fees: ["commission", "fees", "fee", "regulatory fees", "total fees", "commissions", "broker fee"],
  date: ["date", "trade date", "execution date", "fill date", "activity date", "settlement date"],
  time: ["time", "trade time", "execution time", "fill time"],
  dateTime: ["datetime", "date/time", "executed at", "timestamp", "fill time", "transaction time", "exec time"],
  iv: ["iv", "implied volatility", "impl vol", "implied vol"],
  delta: ["delta"],
  gamma: ["gamma"],
  theta: ["theta"],
  vega: ["vega"],
  rho: ["rho"],
  orderId: ["order id", "orderid", "execution id", "trade id", "activity id", "reference id", "ref id", "exec id", "order #"],
  underlyingPrice: ["underlying price", "stock price", "spot price", "last price"],
  multiplier: ["multiplier", "contract multiplier", "mult"],
  pnl: ["pnl", "p&l", "profit", "profit/loss", "profit loss", "realized pnl", "realized p&l", "net profit", "gain/loss"],
  description: ["description", "desc", "details", "notes", "memo"],
  skip: [],
};

/**
 * Fuzzy match a header string to the best internal field
 */
function matchHeader(header: string): { field: OptionsField; confidence: ConfidenceLevel } | null {
  const lower = header.toLowerCase().replace(/[_\-#]/g, " ").replace(/\s+/g, " ").trim();

  // Pass 1: exact alias match (highest priority)
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [OptionsField, string[]][]) {
    if (field === "skip") continue;
    if (aliases.includes(lower)) return { field, confidence: "high" };
  }

  // Pass 2: contains match, but only if the match is substantial (avoid "price" matching "strikeprice")
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [OptionsField, string[]][]) {
    if (field === "skip") continue;
    for (const alias of aliases) {
      // Only match if lengths are similar (within 2x) to avoid spurious substring matches
      if ((lower.includes(alias) || alias.includes(lower)) && 
          Math.max(lower.length, alias.length) <= Math.min(lower.length, alias.length) * 2.5) {
        return { field, confidence: "medium" };
      }
    }
  }

  return null;
}

/**
 * Auto-map CSV headers to internal options fields using fuzzy matching + content inference
 */
export function mapCsvHeaders(
  headers: string[],
  sampleRows: string[][],
): ColumnMapping[] {
  const usedFields = new Set<OptionsField>();
  const mappings: ColumnMapping[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const samples = sampleRows.slice(0, 5).map(r => r[i] || "").filter(Boolean);
    let match = matchHeader(header);

    // Content-based inference if header match fails or is ambiguous
    if (!match && samples.length > 0) {
      match = inferFromContent(header, samples);
    }

    // Avoid duplicate field mappings (prefer first match)
    if (match && usedFields.has(match.field)) {
      // Demote to skip or lower confidence
      match = null;
    }

    if (match) {
      usedFields.add(match.field);
      mappings.push({
        csvColumnIndex: i,
        csvColumnName: header,
        mappedField: match.field,
        confidence: match.confidence,
        sampleValues: samples.slice(0, 3),
      });
    } else {
      mappings.push({
        csvColumnIndex: i,
        csvColumnName: header,
        mappedField: "skip",
        confidence: "low",
        sampleValues: samples.slice(0, 3),
      });
    }
  }

  return mappings;
}

/**
 * Infer field type from sample values when header matching fails
 */
function inferFromContent(header: string, samples: string[]): { field: OptionsField; confidence: ConfidenceLevel } | null {
  // Check if values look like option symbols
  if (samples.some(s => looksLikeOptionSymbol(s))) {
    return { field: "symbol", confidence: "medium" };
  }

  // Check if values look like call/put
  if (samples.every(s => /^(call|put|c|p)$/i.test(s.trim()))) {
    return { field: "optionType", confidence: "medium" };
  }

  // Check if values look like buy/sell actions
  if (samples.every(s => /^(buy|sell|bto|stc|sto|btc)/i.test(s.trim()))) {
    return { field: "action", confidence: "medium" };
  }

  // Check if values look like dates
  if (samples.every(s => /\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}/.test(s))) {
    return { field: "date", confidence: "low" };
  }

  return null;
}

/**
 * Get all available options fields for manual override
 */
export function getAvailableFields(): { value: OptionsField; label: string }[] {
  return [
    { value: "symbol", label: "Option Symbol" },
    { value: "underlying", label: "Underlying Ticker" },
    { value: "optionType", label: "Call / Put" },
    { value: "strike", label: "Strike Price" },
    { value: "expiration", label: "Expiration Date" },
    { value: "action", label: "Action (BTO/STC/etc)" },
    { value: "side", label: "Side (Buy/Sell)" },
    { value: "openClose", label: "Open / Close" },
    { value: "contracts", label: "Contracts / Qty" },
    { value: "price", label: "Premium / Price" },
    { value: "totalAmount", label: "Total Amount" },
    { value: "fees", label: "Fees / Commission" },
    { value: "date", label: "Trade Date" },
    { value: "time", label: "Trade Time" },
    { value: "dateTime", label: "Date & Time" },
    { value: "iv", label: "Implied Volatility" },
    { value: "delta", label: "Delta" },
    { value: "gamma", label: "Gamma" },
    { value: "theta", label: "Theta" },
    { value: "vega", label: "Vega" },
    { value: "rho", label: "Rho" },
    { value: "orderId", label: "Order / Trade ID" },
    { value: "underlyingPrice", label: "Underlying Price" },
    { value: "multiplier", label: "Contract Multiplier" },
    { value: "pnl", label: "P&L" },
    { value: "description", label: "Description" },
    { value: "skip", label: "— Skip —" },
  ];
}
