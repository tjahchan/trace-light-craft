/**
 * Contract sizes (units per 1 standard lot) for commodities and indices.
 */
const CONTRACT_SIZES: Record<string, number> = {
  // Metals
  COPPER: 25000,
  XAUUSD: 100,
  XAGUSD: 5000,
  XPTUSD: 100,
  XPDUSD: 100,

  // Energy
  USOIL: 1000,
  UKOIL: 1000,
  BRENT: 1000,
  WTI: 1000,
  NGAS: 10000,
  NATGAS: 10000,

  // Indices (common broker symbols)
  US30: 1,
  US500: 1,
  NAS100: 1,
  JP225: 1,
  DAX: 1,
  FTSE: 1,
  SPX500: 1,
};

export type AssetClass = "forex" | "crypto" | "commodity" | "index";

/**
 * Determine asset class from symbol string.
 */
export function getAssetClass(symbol: string): AssetClass {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Crypto
  if (
    ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "LTC", "BNB", "AVAX", "DOT"].some((c) =>
      s.startsWith(c)
    )
  ) {
    return "crypto";
  }

  // Metals
  if (["XAU", "XAG", "XPT", "XPD"].some((c) => s.includes(c)) || s === "COPPER") {
    return "commodity";
  }

  // Energy
  if (["OIL", "NGAS", "NATGAS", "BRENT", "WTI"].some((c) => s.includes(c))) {
    return "commodity";
  }

  // Indices
  if (
    ["SPX", "NAS", "DOW", "DAX", "FTSE", "US30", "US500", "JP225"].some((c) => s.includes(c))
  ) {
    return "index";
  }

  // Default to forex
  return "forex";
}

/**
 * Get the contract size (units per lot) for a given symbol.
 */
export function getContractSize(symbol: string): number {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const assetClass = getAssetClass(s);

  if (assetClass === "crypto") return 1;

  if (assetClass === "commodity") {
    // Try exact match first
    if (CONTRACT_SIZES[s]) return CONTRACT_SIZES[s];
    // Try partial match for keys
    for (const key of Object.keys(CONTRACT_SIZES)) {
      if (s.includes(key)) return CONTRACT_SIZES[key];
    }
    return 100; // default commodity fallback
  }

  if (assetClass === "index") {
    if (CONTRACT_SIZES[s]) return CONTRACT_SIZES[s];
    for (const key of Object.keys(CONTRACT_SIZES)) {
      if (s.includes(key)) return CONTRACT_SIZES[key];
    }
    return 1;
  }

  // Forex
  return 100000;
}

/**
 * Human-readable contract size label for display.
 */
export function getContractSizeLabel(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const assetClass = getAssetClass(s);
  const size = getContractSize(s);

  if (assetClass === "forex") return null; // standard, no need to show
  if (assetClass === "crypto") return null;

  if (s.includes("XAU")) return `${size} oz/lot (Gold)`;
  if (s.includes("XAG")) return `${size} oz/lot (Silver)`;
  if (s.includes("XPT")) return `${size} oz/lot (Platinum)`;
  if (s.includes("XPD")) return `${size} oz/lot (Palladium)`;
  if (s === "COPPER" || s.includes("COPPER")) return `${size.toLocaleString()} lbs/lot (Copper)`;
  if (s.includes("OIL") || s.includes("WTI") || s.includes("BRENT"))
    return `${size.toLocaleString()} barrels/lot`;
  if (s.includes("NGAS") || s.includes("NATGAS"))
    return `${size.toLocaleString()} MMBtu/lot (Natural Gas)`;

  return `${size.toLocaleString()} units/lot`;
}

/**
 * Calculate realized PnL for a trade.
 */
export function calculatePnl(
  entry: number,
  exit: number,
  qty: number,
  side: string,
  symbol: string,
  brokerFee: number = 0
): number {
  if (!entry || !exit || !qty) return 0;
  const contractSize = getContractSize(symbol);
  const direction =
    side.toLowerCase() === "long" || side.toLowerCase() === "buy" ? 1 : -1;
  const raw = direction * (exit - entry) * qty * contractSize;
  return raw - (brokerFee ?? 0);
}

/**
 * Calculate risk % given entry, SL, qty, symbol, and account balance.
 */
export function calculateRiskPercent(
  entry: number,
  sl: number | null,
  qty: number,
  symbol: string,
  balance: number
): number | null {
  if (!sl || balance <= 0 || !entry || !qty) return null;
  const contractSize = getContractSize(symbol);
  const distance = Math.abs(entry - sl);
  const riskValue = distance * qty * contractSize;
  return (riskValue / balance) * 100;
}
