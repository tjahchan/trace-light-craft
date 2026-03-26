import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LivePriceData {
  [symbol: string]: number | null;
}

/**
 * Hook that polls live prices for a list of symbols every 15 seconds
 * via a backend edge function (avoids CORS issues).
 */
export function useLivePrices(symbols: string[]): LivePriceData {
  const [prices, setPrices] = useState<LivePriceData>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    if (symbols.length === 0) return;
    const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];

    try {
      const { data, error } = await supabase.functions.invoke("live-prices", {
        body: { symbols: uniqueSymbols },
      });

      if (error) {
        console.warn("[LivePrice] Edge function error:", error.message);
        return;
      }

      if (data?.prices) {
        const newPrices: LivePriceData = {};
        for (const [sym, price] of Object.entries(data.prices)) {
          if (price != null) {
            newPrices[sym] = price as number;
          }
        }
        setPrices((prev) => ({ ...prev, ...newPrices }));
      }
    } catch (e) {
      console.warn("[LivePrice] Failed to fetch prices:", e);
    }
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
