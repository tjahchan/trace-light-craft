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
  { id: "binance", name: "Binance", logo: "/brokers/binance.png", provider: "snaptrade", priority: 3 },
  { id: "coinbase", name: "Coinbase", logo: "/brokers/coinbase.png", provider: "snaptrade", priority: 4 },
  { id: "etrade", name: "E*TRADE", logo: "/brokers/etrade.png", provider: "snaptrade", priority: 5 },
  { id: "alpaca", name: "Alpaca", logo: "/brokers/alpaca.jpg", provider: "snaptrade", priority: 6 },
  { id: "degiro", name: "DEGIRO", logo: "/brokers/degiro.webp", provider: "snaptrade", priority: 7 },
  { id: "aj-bell", name: "AJ Bell", logo: "/brokers/aj-bell.webp", provider: "snaptrade", priority: 8 },
  { id: "commsec", name: "CommSec", logo: "/brokers/commsec.png", provider: "snaptrade", priority: 9 },
  { id: "bux", name: "BUX", logo: "/brokers/bux.png", provider: "snaptrade", priority: 10 },
  // TradeLocker broker
  { id: "tradelocker", name: "TradeLocker", logo: "", provider: "tradelocker", priority: 11 },
];

/** Sorted by priority for display */
export const sortedBrokers = [...brokers].sort((a, b) => a.priority - b.priority);

/** Only brokers that have logos (for the website strip) */
export const brokersWithLogos = sortedBrokers.filter((b) => b.logo);

/** Get the provider for a given broker id */
export function getProviderForBroker(brokerId: string): BrokerProvider {
  return brokers.find((b) => b.id === brokerId)?.provider ?? "unsupported";
}
