/**
 * Options CSV Import — Broker / Format Detection
 */

import type { DetectedBroker, ImportContentType } from "./types";
import { looksLikeOptionSymbol } from "./symbol-parser";

interface DetectionResult {
  broker: DetectedBroker;
  contentType: ImportContentType;
  confidence: string;
}

const BROKER_SIGNATURES: { broker: DetectedBroker; headerPatterns: string[][] }[] = [
  {
    broker: "thinkorswim",
    headerPatterns: [
      ["exec time", "spread", "side", "qty", "pos effect"],
      ["trade date", "symbol", "buy/sell", "open/close"],
    ],
  },
  {
    broker: "tastytrade",
    headerPatterns: [
      ["date", "type", "action", "symbol", "instrument type", "description"],
      ["executed at", "action", "symbol", "underlying symbol"],
    ],
  },
  {
    broker: "interactive_brokers",
    headerPatterns: [
      ["symbol", "date/time", "quantity", "t. price", "proceeds", "comm/fee"],
      ["trades", "header", "asset category", "symbol", "date/time"],
    ],
  },
  {
    broker: "robinhood",
    headerPatterns: [
      ["activity date", "instrument", "description", "trans code", "quantity", "price", "amount"],
    ],
  },
  {
    broker: "schwab",
    headerPatterns: [
      ["date", "action", "symbol", "description", "quantity", "price", "fees & comm", "amount"],
    ],
  },
  {
    broker: "webull",
    headerPatterns: [
      ["symbol", "side", "qty", "price", "create time", "fill time"],
    ],
  },
  {
    broker: "fidelity",
    headerPatterns: [
      ["run date", "action", "symbol", "security description", "security type", "quantity", "price"],
    ],
  },
  {
    broker: "etrade",
    headerPatterns: [
      ["transactiondate", "transactiontype", "securitytype", "symbol", "quantity", "amount", "price", "commission"],
    ],
  },
  {
    broker: "tradier",
    headerPatterns: [
      ["id", "type", "trade_type", "date", "symbol", "quantity", "price"],
    ],
  },
];

export function detectBrokerFormat(headers: string[], sampleRows: string[][]): DetectionResult {
  const lowerHeaders = headers.map(h => h.toLowerCase().replace(/[_\-#]/g, " ").trim());

  // Check broker signatures
  for (const sig of BROKER_SIGNATURES) {
    for (const pattern of sig.headerPatterns) {
      const matchCount = pattern.filter(p => lowerHeaders.some(h => h.includes(p))).length;
      if (matchCount >= Math.ceil(pattern.length * 0.6)) {
        return {
          broker: sig.broker,
          contentType: detectContentType(headers, sampleRows),
          confidence: matchCount === pattern.length ? "high" : "medium",
        };
      }
    }
  }

  return {
    broker: "unknown",
    contentType: detectContentType(headers, sampleRows),
    confidence: "low",
  };
}

function detectContentType(headers: string[], sampleRows: string[][]): ImportContentType {
  const lowerHeaders = headers.map(h => h.toLowerCase());

  // Check for options-specific headers
  const hasOptionsHeaders = lowerHeaders.some(h =>
    ["strike", "expiration", "expiry", "call/put", "option type", "put/call"].some(k => h.includes(k))
  );

  // Check sample values for option symbols
  const hasOptionSymbols = sampleRows.some(row =>
    row.some(cell => looksLikeOptionSymbol(cell))
  );

  // Check for stock-only indicators
  const hasStockHeaders = lowerHeaders.some(h =>
    ["shares", "stock", "equity"].some(k => h.includes(k))
  );

  if (hasOptionsHeaders || hasOptionSymbols) {
    if (hasStockHeaders) return "mixed";
    return "options";
  }

  if (hasStockHeaders) return "stocks";

  // Check if any description/symbol cells contain option-like content
  const allValues = sampleRows.flat().join(" ");
  if (/\b(call|put|strike|expir)/i.test(allValues)) return "mixed";

  return "unsupported";
}
