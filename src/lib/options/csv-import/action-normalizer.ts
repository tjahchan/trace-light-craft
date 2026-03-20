/**
 * Options CSV Import — Action / Side / Open-Close Normalizer
 */

import type { NormalizedAction, ConfidenceLevel } from "./types";

const ACTION_MAP: Record<string, { positionSide: "long" | "short"; rowEffect: "entry" | "exit"; openClose: "open" | "close" }> = {
  // Standard abbreviations
  "bto": { positionSide: "long", rowEffect: "entry", openClose: "open" },
  "buy to open": { positionSide: "long", rowEffect: "entry", openClose: "open" },
  "buy_to_open": { positionSide: "long", rowEffect: "entry", openClose: "open" },
  "buytoopen": { positionSide: "long", rowEffect: "entry", openClose: "open" },

  "stc": { positionSide: "long", rowEffect: "exit", openClose: "close" },
  "sell to close": { positionSide: "long", rowEffect: "exit", openClose: "close" },
  "sell_to_close": { positionSide: "long", rowEffect: "exit", openClose: "close" },
  "selltoclose": { positionSide: "long", rowEffect: "exit", openClose: "close" },

  "sto": { positionSide: "short", rowEffect: "entry", openClose: "open" },
  "sell to open": { positionSide: "short", rowEffect: "entry", openClose: "open" },
  "sell_to_open": { positionSide: "short", rowEffect: "entry", openClose: "open" },
  "selltoopen": { positionSide: "short", rowEffect: "entry", openClose: "open" },

  "btc": { positionSide: "short", rowEffect: "exit", openClose: "close" },
  "buy to close": { positionSide: "short", rowEffect: "exit", openClose: "close" },
  "buy_to_close": { positionSide: "short", rowEffect: "exit", openClose: "close" },
  "buytoclose": { positionSide: "short", rowEffect: "exit", openClose: "close" },

  // Compound side + open/close
  "buy open": { positionSide: "long", rowEffect: "entry", openClose: "open" },
  "sell close": { positionSide: "long", rowEffect: "exit", openClose: "close" },
  "sell open": { positionSide: "short", rowEffect: "entry", openClose: "open" },
  "buy close": { positionSide: "short", rowEffect: "exit", openClose: "close" },

  // Opening/closing transaction
  "opening transaction": { positionSide: "long", rowEffect: "entry", openClose: "open" },
  "closing transaction": { positionSide: "long", rowEffect: "exit", openClose: "close" },
};

/**
 * Normalize an action string into structured position/effect data.
 * Combines action + optional side + optional open/close columns.
 */
export function normalizeAction(
  action?: string | null,
  side?: string | null,
  openClose?: string | null,
  quantitySign?: number | null,
  amountSign?: number | null,
): NormalizedAction | null {
  // Build combined action string from available fields
  let combined = "";
  if (action) combined = action.trim();
  else if (side && openClose) combined = `${side.trim()} ${openClose.trim()}`;
  else if (side) combined = side.trim();

  if (!combined) return null;

  const lower = combined.toLowerCase().replace(/[_\-]/g, " ").replace(/\s+/g, " ").trim();

  // Direct lookup
  const direct = ACTION_MAP[lower];
  if (direct) {
    return {
      positionSide: direct.positionSide,
      rowEffect: direct.rowEffect,
      openCloseEffect: direct.openClose,
      cashFlowDirection: direct.rowEffect === "entry"
        ? (direct.positionSide === "long" ? "debit" : "credit")
        : (direct.positionSide === "long" ? "credit" : "debit"),
      confidence: "high",
      rawAction: combined,
    };
  }

  // Simple Buy/Sell with open/close context
  const isBuy = /^buy$/i.test(combined) || /\bbuy\b/i.test(combined);
  const isSell = /^sell$/i.test(combined) || /\bsell\b/i.test(combined);
  const isOpen = openClose ? /open/i.test(openClose) : false;
  const isClose = openClose ? /close/i.test(openClose) : false;

  if (isBuy && isOpen) return makeAction("long", "entry", "open", "high", combined);
  if (isSell && isClose) return makeAction("long", "exit", "close", "high", combined);
  if (isSell && isOpen) return makeAction("short", "entry", "open", "high", combined);
  if (isBuy && isClose) return makeAction("short", "exit", "close", "high", combined);

  // Fallback: infer from quantity/amount sign
  if (isBuy || isSell) {
    // Use sign heuristics
    if (quantitySign != null) {
      if (quantitySign > 0 && isBuy) return makeAction("long", "entry", "open", "medium", combined);
      if (quantitySign < 0 && isSell) return makeAction("long", "exit", "close", "medium", combined);
      if (quantitySign > 0 && isSell) return makeAction("short", "entry", "open", "medium", combined);
      if (quantitySign < 0 && isBuy) return makeAction("short", "exit", "close", "medium", combined);
    }

    // Pure buy/sell without open/close — ambiguous
    if (isBuy) return makeAction("long", "entry", "open", "low", combined);
    if (isSell) return makeAction("short", "entry", "open", "low", combined);
  }

  // Long/Short as side
  if (/^long$/i.test(combined)) return makeAction("long", "entry", "open", "medium", combined);
  if (/^short$/i.test(combined)) return makeAction("short", "entry", "open", "medium", combined);

  return null;
}

function makeAction(
  positionSide: "long" | "short",
  rowEffect: "entry" | "exit",
  openCloseEffect: "open" | "close",
  confidence: ConfidenceLevel,
  rawAction: string,
): NormalizedAction {
  return {
    positionSide,
    rowEffect,
    openCloseEffect,
    cashFlowDirection: rowEffect === "entry"
      ? (positionSide === "long" ? "debit" : "credit")
      : (positionSide === "long" ? "credit" : "debit"),
    confidence,
    rawAction,
  };
}
