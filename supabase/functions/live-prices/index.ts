const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRYPTO_MAP: Record<string, string> = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", XRP: "XRPUSDT",
  ADA: "ADAUSDT", DOGE: "DOGEUSDT", LTC: "LTCUSDT", BNB: "BNBUSDT",
  AVAX: "AVAXUSDT", DOT: "DOTUSDT",
};

function getCryptoTicker(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const [prefix, ticker] of Object.entries(CRYPTO_MAP)) {
    if (s.startsWith(prefix)) return ticker;
  }
  return null;
}

function getYahooTicker(symbol: string): string {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.includes("XAU")) return "GC=F";
  if (s.includes("XAG")) return "SI=F";
  if (s.includes("USOIL") || s.includes("WTI")) return "CL=F";
  if (s.includes("UKOIL") || s.includes("BRENT")) return "BZ=F";
  if (s.includes("NGAS") || s.includes("NATGAS")) return "NG=F";
  if (s.includes("US30")) return "YM=F";
  if (s.includes("NAS100") || s.includes("NAS")) return "NQ=F";
  if (s.includes("US500") || s.includes("SPX")) return "ES=F";
  if (s.length === 6 && /^[A-Z]{6}$/.test(s)) return `${s}=X`;
  return `${s}=X`;
}

async function fetchCryptoPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${ticker}`);
    if (res.ok) {
      const data = await res.json();
      return parseFloat(data.price);
    }
  } catch { /* ignore */ }
  return null;
}

async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }
    );
    if (res.ok) {
      const data = await res.json();
      return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols } = await req.json();
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return new Response(JSON.stringify({ prices: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const unique = [...new Set(symbols.map((s: string) => s.toUpperCase()))];
    const prices: Record<string, number | null> = {};

    await Promise.all(
      unique.map(async (sym) => {
        const cryptoTicker = getCryptoTicker(sym);
        if (cryptoTicker) {
          prices[sym] = await fetchCryptoPrice(cryptoTicker);
        } else {
          const yahooTicker = getYahooTicker(sym);
          prices[sym] = await fetchYahooPrice(yahooTicker);
        }
      })
    );

    return new Response(JSON.stringify({ prices }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
