/**
 * Centralized broker configuration.
 * Add new brokers here — they automatically appear in the website logo strip
 * and the in-app broker selection modal.
 */

export type BrokerProvider = "snaptrade" | "tradelocker" | "unsupported";

export interface BrokerEntry {
  id: string;
  name: string;
  logo: string; // path relative to /public
  provider: BrokerProvider;
  /** Priority for display order — lower number = shown first */
  priority: number;
  /** Hide from the marketing website logo strip */
  hiddenFromStrip?: boolean;
}

export const brokers: BrokerEntry[] = [
  { id: "interactive-brokers", name: "Interactive Brokers", logo: "/brokers/interactive-brokers.png", provider: "snaptrade", priority: 1 },
  { id: "schwab", name: "Charles Schwab", logo: "/brokers/schwab.svg", provider: "snaptrade", priority: 2 },
  { id: "wealthsimple", name: "Wealthsimple", logo: "/brokers/wealthsimple.png", provider: "snaptrade", priority: 3 },
  { id: "robinhood", name: "Robinhood", logo: "/brokers/robinhood.jpg", provider: "snaptrade", priority: 4 },
  { id: "binance", name: "Binance", logo: "/brokers/binance.png", provider: "snaptrade", priority: 5 },
  { id: "kraken", name: "Kraken", logo: "/brokers/kraken.webp", provider: "snaptrade", priority: 6 },
  { id: "coinbase", name: "Coinbase", logo: "/brokers/coinbase.png", provider: "snaptrade", priority: 7 },
  { id: "vanguard", name: "Vanguard", logo: "/brokers/vanguard.png", provider: "snaptrade", priority: 8 },
  { id: "webull", name: "Webull", logo: "/brokers/webull.webp", provider: "snaptrade", priority: 9 },
  { id: "td-ameritrade", name: "TD Ameritrade", logo: "/brokers/td-ameritrade.jpg", provider: "snaptrade", priority: 10 },
  { id: "etrade", name: "E*TRADE", logo: "/brokers/etrade.png", provider: "snaptrade", priority: 11, hiddenFromStrip: true },
  { id: "tastytrade", name: "tastytrade", logo: "/brokers/tastytrade.webp", provider: "snaptrade", priority: 12, hiddenFromStrip: true },
  { id: "questrade", name: "Questrade", logo: "/brokers/questrade.webp", provider: "snaptrade", priority: 13 },
  { id: "trading212", name: "Trading 212", logo: "/brokers/trading212.png", provider: "snaptrade", priority: 14 },
  { id: "degiro", name: "DEGIRO", logo: "/brokers/degiro.webp", provider: "snaptrade", priority: 15, hiddenFromStrip: true },
  { id: "moomoo", name: "Moomoo", logo: "/brokers/moomoo.webp", provider: "snaptrade", priority: 16, hiddenFromStrip: true },
  { id: "alpaca", name: "Alpaca", logo: "/brokers/alpaca.jpg", provider: "snaptrade", priority: 17 },
  { id: "stake", name: "Stake", logo: "/brokers/stake.png", provider: "snaptrade", priority: 18 },
  { id: "public", name: "Public", logo: "/brokers/public.jpg", provider: "snaptrade", priority: 19 },
  { id: "aj-bell", name: "AJ Bell", logo: "/brokers/aj-bell.webp", provider: "snaptrade", priority: 20 },
  { id: "commsec", name: "CommSec", logo: "/brokers/commsec.png", provider: "snaptrade", priority: 21 },
  { id: "bux", name: "BUX", logo: "/brokers/bux.png", provider: "snaptrade", priority: 22 },
  { id: "zerodha", name: "Zerodha", logo: "/brokers/zerodha.webp", provider: "snaptrade", priority: 23, hiddenFromStrip: true },
  { id: "upstox", name: "Upstox", logo: "/brokers/upstox.webp", provider: "snaptrade", priority: 24, hiddenFromStrip: true },
  // TradeLocker broker
  { id: "tradelocker", name: "TradeLocker", logo: "/brokers/tradelocker.webp", provider: "tradelocker", priority: 25 },
];

/** Sorted by priority for display */
export const sortedBrokers = [...brokers].sort((a, b) => a.priority - b.priority);

/** Only brokers that have logos (for the website strip) */
export const brokersWithLogos = sortedBrokers.filter((b) => b.logo);

/** Get the provider for a given broker id */
export function getProviderForBroker(brokerId: string): BrokerProvider {
  return brokers.find((b) => b.id === brokerId)?.provider ?? "unsupported";
}
