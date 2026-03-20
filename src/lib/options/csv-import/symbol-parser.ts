/**
 * Options CSV Import — Option Symbol Parser
 *
 * Parses OCC-style and broker-formatted option symbols to extract:
 * underlying ticker, expiration, option type, strike price
 */

import type { OptionType } from "../types";
import type { ParsedOptionSymbol } from "./types";

/**
 * OCC format: AAPL240621C00200000
 * Structure: ROOT(1-6 chars) + DATE(6 digits YYMMDD) + TYPE(C/P) + STRIKE(8 digits, price * 1000)
 */
const OCC_REGEX = /^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/;

/**
 * Spaced format variants:
 * "TSLA 06/21/2024 200 P"
 * "SPY 21 JUN 24 540 CALL"
 * "AMZN 07/19/24 P 185"
 */
const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/**
 * Underscore format: META_2024-06-21_500_C
 */
const UNDERSCORE_REGEX = /^([A-Z]{1,6})_(\d{4}-\d{2}-\d{2})_(\d+(?:\.\d+)?)_([CP])$/i;

export function parseOptionSymbol(raw: string): ParsedOptionSymbol | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw.trim().toUpperCase();

  // Try OCC format first
  const occMatch = cleaned.match(OCC_REGEX);
  if (occMatch) {
    const [, ticker, dateStr, typeChar, strikeStr] = occMatch;
    const year = 2000 + parseInt(dateStr.slice(0, 2));
    const month = dateStr.slice(2, 4);
    const day = dateStr.slice(4, 6);
    return {
      underlyingTicker: ticker,
      expirationDate: `${year}-${month}-${day}`,
      optionType: typeChar === "C" ? "call" : "put",
      strikePrice: parseInt(strikeStr) / 1000,
      raw,
    };
  }

  // Try underscore format
  const underscoreMatch = cleaned.match(UNDERSCORE_REGEX);
  if (underscoreMatch) {
    const [, ticker, date, strike, typeChar] = underscoreMatch;
    return {
      underlyingTicker: ticker,
      expirationDate: date,
      optionType: typeChar === "C" ? "call" : "put",
      strikePrice: parseFloat(strike),
      raw,
    };
  }

  // Try spaced formats
  return parseSpacedSymbol(cleaned, raw);
}

function parseSpacedSymbol(cleaned: string, raw: string): ParsedOptionSymbol | null {
  // Split on whitespace
  const parts = cleaned.split(/[\s]+/).filter(Boolean);
  if (parts.length < 3) return null;

  // Extract ticker (first alphabetic-only part)
  const ticker = parts[0].match(/^[A-Z]{1,6}$/)?.[0];
  if (!ticker) return null;

  let optionType: OptionType | null = null;
  let strikePrice: number | null = null;
  let expirationDate: string | null = null;

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];

    // Option type
    if (/^(CALL|C)$/.test(p)) { optionType = "call"; continue; }
    if (/^(PUT|P)$/.test(p)) { optionType = "put"; continue; }

    // Date with slashes: MM/DD/YYYY or MM/DD/YY
    const slashDate = p.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashDate) {
      const [, m, d, y] = slashDate;
      const year = y.length === 2 ? `20${y}` : y;
      expirationDate = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      continue;
    }

    // Month name: JUN, JUL etc
    if (MONTHS[p]) {
      // Look for day before and year after, or day after and year after
      const prevPart = parts[i - 1];
      const nextPart = parts[i + 1];
      let day: string | null = null;
      let year: string | null = null;

      if (prevPart && /^\d{1,2}$/.test(prevPart) && prevPart !== ticker) {
        day = prevPart.padStart(2, "0");
      }
      if (nextPart && /^\d{2,4}$/.test(nextPart)) {
        year = nextPart.length === 2 ? `20${nextPart}` : nextPart;
        i++; // skip year part
      }
      // Day might be after month
      if (!day && nextPart && /^\d{1,2}$/.test(nextPart)) {
        day = nextPart.padStart(2, "0");
        if (parts[i + 1] && /^\d{2,4}$/.test(parts[i + 1])) {
          year = parts[i + 1].length === 2 ? `20${parts[i + 1]}` : parts[i + 1];
          i++;
        }
        i++;
      }

      if (day && year) {
        expirationDate = `${year}-${MONTHS[p]}-${day}`;
      }
      continue;
    }

    // Numeric: could be strike or day
    const num = parseFloat(p);
    if (!isNaN(num) && num > 0) {
      // If larger than 31 or has decimal, likely strike
      if (num > 31 || p.includes(".")) {
        strikePrice = num;
      }
      // Small integers might be day of month (handled in month logic above)
    }
  }

  if (ticker && optionType && strikePrice && expirationDate) {
    return { underlyingTicker: ticker, expirationDate, optionType, strikePrice, raw };
  }

  return null;
}

/**
 * Check if a string looks like it might be an option symbol
 */
export function looksLikeOptionSymbol(value: string): boolean {
  if (!value) return false;
  const cleaned = value.trim().toUpperCase();
  // OCC format
  if (OCC_REGEX.test(cleaned)) return true;
  // Contains C/P or CALL/PUT with numbers
  if (/[CP]\d{5,}/.test(cleaned)) return true;
  if (/\b(CALL|PUT)\b/i.test(value) && /\d/.test(value)) return true;
  return false;
}
