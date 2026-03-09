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
}

export const brokers: BrokerEntry[] = [
  { id: "interactive-brokers", name: "Interactive Brokers", logo: "/brokers/interactive-brokers.png", provider: "snaptrade", priority: 1 },
  { id: "schwab", name: "Charles Schwab", logo: "/brokers/schwab.svg", provider: "snaptrade", priority: 2 },
  { id: "robinhood", name: "Robinhood", logo: "/brokers/robinhood.jpg", provider: "snaptrade", priority: 3 },
  { id: "binance", name: "Binance", logo: "/brokers/binance.png", provider: "snaptrade", priority: 4 },
  { id: "kraken", name: "Kraken", logo: "/brokers/kraken.webp", provider: "snaptrade", priority: 5 },
  { id: "coinbase", name: "Coinbase", logo: "/brokers/coinbase.png", provider: "snaptrade", priority: 6 },
  { id: "td-ameritrade", name: "TD Ameritrade", logo: "/brokers/td-ameritrade.jpg", provider: "snaptrade", priority: 7 },
  { id: "etrade", name: "E*TRADE", logo: "/brokers/etrade.png", provider: "snaptrade", priority: 8 },
  { id: "tastytrade", name: "tastytrade", logo: "/brokers/tastytrade.webp", provider: "snaptrade", priority: 9 },
  { id: "questrade", name: "Questrade", logo: "/brokers/questrade.webp", provider: "snaptrade", priority: 10 },
  { id: "trading212", name: "Trading 212", logo: "/brokers/trading212.png", provider: "snaptrade", priority: 11 },
  { id: "degiro", name: "DEGIRO", logo: "/brokers/degiro.webp", provider: "snaptrade", priority: 12 },
  { id: "moomoo", name: "Moomoo", logo: "/brokers/moomoo.webp", provider: "snaptrade", priority: 13 },
  { id: "alpaca", name: "Alpaca", logo: "/brokers/alpaca.jpg", provider: "snaptrade", priority: 14 },
  { id: "stake", name: "Stake", logo: "/brokers/stake.png", provider: "snaptrade", priority: 15 },
  { id: "public", name: "Public", logo: "/brokers/public.jpg", provider: "snaptrade", priority: 16 },
  { id: "aj-bell", name: "AJ Bell", logo: "/brokers/aj-bell.webp", provider: "snaptrade", priority: 17 },
  { id: "commsec", name: "CommSec", logo: "/brokers/commsec.png", provider: "snaptrade", priority: 18 },
  { id: "bux", name: "BUX", logo: "/brokers/bux.png", provider: "snaptrade", priority: 19 },
  // TradeLocker broker
  { id: "tradelocker", name: "TradeLocker", logo: "/brokers/tradelocker.webp", provider: "tradelocker", priority: 20 },
];

/** Sorted by priority for display */
export const sortedBrokers = [...brokers].sort((a, b) => a.priority - b.priority);

/** Only brokers that have logos (for the website strip) */
export const brokersWithLogos = sortedBrokers.filter((b) => b.logo);

/** Get the provider for a given broker id */
export function getProviderForBroker(brokerId: string): BrokerProvider {
  return brokers.find((b) => b.id === brokerId)?.provider ?? "unsupported";
}
