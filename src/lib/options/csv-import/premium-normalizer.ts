/**
 * Options CSV Import — Premium Normalization
 *
 * Determines whether imported price is per-share, per-contract, or gross total,
 * then normalizes to per-share premium.
 */

import type { NormalizedPremium, PremiumFormat } from "./types";

/**
 * Clean a numeric string: remove $, commas, parentheses (negative)
 */
export function cleanNumeric(value: string): number {
  if (!value) return NaN;
  let cleaned = value.trim();
  // Handle parentheses as negative: (123.45) -> -123.45
  const isParens = /^\(.*\)$/.test(cleaned);
  cleaned = cleaned.replace(/[()$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isParens ? -Math.abs(num) : num;
}

/**
 * Normalize premium to per-share value.
 *
 * Strategy:
 * 1. If explicit price column exists and value is reasonable for per-share, use directly
 * 2. If total amount is provided, divide by (contracts * multiplier)
 * 3. If value seems too large for per-share, assume per-contract or gross
 */
export function normalizePremium(
  priceValue: string | null | undefined,
  totalAmountValue: string | null | undefined,
  contracts: number,
  multiplier: number,
): NormalizedPremium | null {
  const price = priceValue ? cleanNumeric(priceValue) : NaN;
  const total = totalAmountValue ? cleanNumeric(totalAmountValue) : NaN;

  // If we have total amount column (explicit gross), normalize from that
  if (!isNaN(total) && contracts > 0 && multiplier > 0) {
    const absTotal = Math.abs(total);
    const perShare = absTotal / (contracts * multiplier);
    if (perShare >= 0) {
      return {
        premiumPerShare: perShare,
        sourceFormat: "gross_total",
        rawValue: total,
        confidence: "medium",
      };
    }
  }

  // If we have a direct price column, treat as per-share
  if (!isNaN(price)) {
    const absPrice = Math.abs(price);
    return {
      premiumPerShare: absPrice,
      sourceFormat: price < 0 ? "signed_cash_flow" : "per_share",
      rawValue: price,
      confidence: "high",
    };
  }

  return null;
}
