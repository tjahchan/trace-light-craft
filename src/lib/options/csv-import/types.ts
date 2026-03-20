/**
 * Options CSV Import — Type Definitions
 */

import type { OptionType, PositionSide, OptionTradeStatus } from "../types";

// ─── Confidence Scoring ───────────────────────────────────────
export type ConfidenceLevel = "high" | "medium" | "low";

// ─── Parsed Option Symbol ─────────────────────────────────────
export interface ParsedOptionSymbol {
  underlyingTicker: string;
  expirationDate: string; // YYYY-MM-DD
  optionType: OptionType;
  strikePrice: number;
  raw: string;
}

// ─── Normalized Action ────────────────────────────────────────
export type RowEffect = "entry" | "exit";
export type OpenCloseEffect = "open" | "close";
export type CashFlowDirection = "debit" | "credit";

export interface NormalizedAction {
  positionSide: PositionSide;
  rowEffect: RowEffect;
  openCloseEffect: OpenCloseEffect;
  cashFlowDirection: CashFlowDirection;
  confidence: ConfidenceLevel;
  rawAction: string;
}

// ─── Premium Normalization ────────────────────────────────────
export type PremiumFormat = "per_share" | "per_contract" | "gross_total" | "signed_cash_flow" | "unknown";

export interface NormalizedPremium {
  premiumPerShare: number;
  sourceFormat: PremiumFormat;
  rawValue: number;
  confidence: ConfidenceLevel;
}

// ─── Column Mapping ───────────────────────────────────────────
export type OptionsField =
  | "symbol"
  | "underlying"
  | "optionType"
  | "strike"
  | "expiration"
  | "action"
  | "side"
  | "openClose"
  | "contracts"
  | "price"
  | "totalAmount"
  | "fees"
  | "date"
  | "time"
  | "dateTime"
  | "iv"
  | "delta"
  | "gamma"
  | "theta"
  | "vega"
  | "rho"
  | "orderId"
  | "underlyingPrice"
  | "multiplier"
  | "pnl"
  | "description"
  | "skip";

export interface ColumnMapping {
  csvColumnIndex: number;
  csvColumnName: string;
  mappedField: OptionsField;
  confidence: ConfidenceLevel;
  sampleValues: string[];
}

// ─── Broker Detection ─────────────────────────────────────────
export type DetectedBroker =
  | "interactive_brokers"
  | "thinkorswim"
  | "tastytrade"
  | "robinhood"
  | "webull"
  | "tradier"
  | "schwab"
  | "fidelity"
  | "etrade"
  | "generic"
  | "unknown";

// ─── Import Type Detection ────────────────────────────────────
export type ImportContentType = "options" | "stocks" | "mixed" | "unsupported";

// ─── Parsed Row ───────────────────────────────────────────────
export interface ParsedOptionsRow {
  rowIndex: number;
  raw: Record<string, string>;

  // Parsed fields
  underlyingTicker: string | null;
  optionType: OptionType | null;
  strikePrice: number | null;
  expirationDate: string | null;
  action: NormalizedAction | null;
  contracts: number | null;
  multiplier: number;
  premium: NormalizedPremium | null;
  fees: number;
  dateTime: string | null;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  orderId: string | null;
  underlyingPrice: number | null;
  pnl: number | null;
  description: string | null;

  // Symbol parse result
  symbolParseResult: ParsedOptionSymbol | null;

  // Validation
  errors: string[];
  warnings: string[];
  isValid: boolean;
  isDuplicate: boolean;
}

// ─── Grouped Trade ────────────────────────────────────────────
export interface GroupedTrade {
  id: string;
  underlyingTicker: string;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: string;
  positionSide: PositionSide;
  contracts: number;
  multiplier: number;

  entryPremium: number | null;
  exitPremium: number | null;
  entryDateTime: string | null;
  exitDateTime: string | null;
  entryFees: number;
  exitFees: number;
  realizedPnl: number | null;

  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  underlyingPrice: number | null;
  orderId: string | null;

  status: OptionTradeStatus;
  sourceRows: ParsedOptionsRow[];

  errors: string[];
  warnings: string[];
  isValid: boolean;
  isDuplicate: boolean;
}

// ─── Import Template ──────────────────────────────────────────
export interface ImportTemplate {
  id: string;
  name: string;
  broker: DetectedBroker;
  mappings: Record<number, OptionsField>;
  premiumFormat: PremiumFormat;
  dateFormat: string;
  createdAt: string;
}

// ─── Import Report ────────────────────────────────────────────
export interface ImportReport {
  totalRows: number;
  optionsRows: number;
  importedCount: number;
  duplicateCount: number;
  warningCount: number;
  failedCount: number;
  detectedBroker: DetectedBroker;
  importBatchId: string;
  trades: GroupedTrade[];
}
