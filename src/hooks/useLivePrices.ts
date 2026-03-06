import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Map trading symbols to Yahoo Finance / Binance tickers.
 */
function getYahooTicker(symbol: string): string {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Crypto → Binance
  if (["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "LTC", "BNB", "AVAX", "DOT"].some(c => s.startsWith(c))) {
    // handled separately
    return "";
  }
  // Gold
  if (s.includes("XAU")) return "GC=F";
  if (s.includes("XAG")) return "SI=F";
  if (s === "COPPER" || s.includes("COPPER")) return "HG=F";
  if (s.includes("USOIL") || s.includes("WTI")) return "CL=F";
  if (s.includes("UKOIL") || s.includes("BRENT")) return "BZ=F";
  if (s.includes("NGAS") || s.includes("NATGAS")) return "NG=F";
  // Indices
  if (s.includes("US30")) return "YM=F";
  if (s.includes("NAS100") || s.includes("NAS")) return "NQ=F";
  if (s.includes("US500") || s.includes("SPX")) return "ES=F";
  // Forex pairs (6 chars like EURUSD)
  if (s.length === 6 && /^[A-Z]{6}$/.test(s)) {
    return `${s}=X`;
  }
  return `${s}=X`;
}

function getBinanceTicker(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cryptos = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "LTC", "BNB", "AVAX", "DOT"];
  for (const c of cryptos) {
    if (s.startsWith(c)) {
      // e.g. BTCUSD → BTCUSDT, BTCUSDT stays
      if (s.endsWith("USDT")) return s;
      if (s.endsWith("USD")) return s + "T";
      return c + "USDT";
    }
  }
  return null;
}

async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    // Try Binance first for crypto
    const binanceTicker = getBinanceTicker(symbol);
    if (binanceTicker) {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceTicker}`);
      if (res.ok) {
        const data = await res.json();
        return parseFloat(data.price);
      }
    }

    // Yahoo Finance for everything else — use a CORS proxy or direct
    // Since Yahoo blocks CORS, we'll use a simple proxy approach
    const yahooTicker = getYahooTicker(symbol);
    if (!yahooTicker) return null;

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1m&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (res.ok) {
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      return meta?.regularMarketPrice ?? null;
    }
  } catch (e) {
    console.warn(`[LivePrice] Failed to fetch for ${symbol}:`, e);
  }
  return null;
}

export interface LivePriceData {
  [symbol: string]: number | null;
}

/**
 * Hook that polls live prices for a list of symbols every 15 seconds.
 */
export function useLivePrices(symbols: string[]): LivePriceData {
  const [prices, setPrices] = useState<LivePriceData>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    if (symbols.length === 0) return;
    const uniqueSymbols = [...new Set(symbols)];
    const results = await Promise.allSettled(
      uniqueSymbols.map(async (sym) => {
        const price = await fetchPrice(sym);
        return { sym, price };
      })
    );
    const newPrices: LivePriceData = {};
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.price !== null) {
        newPrices[r.value.sym] = r.value.price;
      }
    }
    setPrices((prev) => ({ ...prev, ...newPrices }));
  }, [symbols.join(",")]);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll]);

  return prices;
}
