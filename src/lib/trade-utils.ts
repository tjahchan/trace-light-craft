/**
 * Determine asset class from symbol string.
 */
export function getAssetClass(symbol: string): "forex" | "crypto" | "commodity" {
  const s = symbol.toUpperCase().replace("/", "");
  // Crypto symbols
  if (["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "LTC", "BNB", "AVAX", "DOT"].some((c) => s.startsWith(c))) {
    return "crypto";
  }
  // Commodities
  if (["XAU", "XAG", "COPPER", "OIL", "BRENT", "NATGAS", "WHEAT", "CORN"].some((c) => s.includes(c))) {
    return "commodity";
  }
  // Default to forex for pairs like EURUSD, GBP/JPY etc.
  return "forex";
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
  const assetClass = getAssetClass(symbol);
  const multiplier = assetClass === "forex" ? 100000 : 1;
  const direction = side === "Long" ? 1 : -1;
  const raw = direction * (exit - entry) * qty * multiplier;
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
  const assetClass = getAssetClass(symbol);
  const multiplier = assetClass === "forex" ? 100000 : 1;
  const distance = Math.abs(entry - sl);
  const riskValue = distance * qty * multiplier;
  return (riskValue / balance) * 100;
}
