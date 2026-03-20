/**
 * Options CSV Import — Trade Grouper & Duplicate Detector
 *
 * Groups parsed rows into logical trades (entry + exit pairs)
 * and detects duplicates via fingerprinting.
 */

import type { ParsedOptionsRow, GroupedTrade } from "./types";
import type { OptionTradeStatus } from "../types";

/**
 * Generate a fingerprint for duplicate detection
 */
export function fingerprintRow(row: ParsedOptionsRow): string {
  return [
    row.underlyingTicker,
    row.optionType,
    row.strikePrice,
    row.expirationDate,
    row.action?.positionSide,
    row.action?.rowEffect,
    row.contracts,
    row.premium?.premiumPerShare?.toFixed(4),
    row.dateTime?.slice(0, 19),
    row.orderId,
  ].filter(Boolean).join("|").toLowerCase();
}

/**
 * Group key for matching entry/exit rows
 */
function groupKey(row: ParsedOptionsRow): string {
  return [
    row.underlyingTicker,
    row.optionType,
    row.strikePrice,
    row.expirationDate,
    row.action?.positionSide,
  ].filter(Boolean).join("|").toLowerCase();
}

/**
 * Group parsed rows into logical trades.
 * Matches entry rows with exit rows by underlying/strike/expiry/side.
 */
export function groupExecutionsIntoTrades(rows: ParsedOptionsRow[]): GroupedTrade[] {
  // Include rows that have core data even with some validation errors
  const usableRows = rows.filter(r => !r.isDuplicate && r.underlyingTicker && r.optionType);
  const entryMap = new Map<string, ParsedOptionsRow[]>();
  const exitMap = new Map<string, ParsedOptionsRow[]>();

  for (const row of validRows) {
    const key = groupKey(row);
    const effect = row.action?.rowEffect;

    if (effect === "exit") {
      if (!exitMap.has(key)) exitMap.set(key, []);
      exitMap.get(key)!.push(row);
    } else {
      // Default to entry
      if (!entryMap.has(key)) entryMap.set(key, []);
      entryMap.get(key)!.push(row);
    }
  }

  const trades: GroupedTrade[] = [];
  const processedExitKeys = new Set<string>();

  // Match entries with exits
  for (const [key, entries] of entryMap) {
    const exits = exitMap.get(key) || [];
    processedExitKeys.add(key);

    // Weighted average entry premium
    let totalEntryContracts = 0;
    let weightedEntryPremium = 0;
    let totalEntryFees = 0;
    let earliestEntry: string | null = null;

    for (const e of entries) {
      const c = e.contracts || 1;
      const p = e.premium?.premiumPerShare || 0;
      totalEntryContracts += c;
      weightedEntryPremium += p * c;
      totalEntryFees += e.fees;
      if (e.dateTime && (!earliestEntry || e.dateTime < earliestEntry)) {
        earliestEntry = e.dateTime;
      }
    }

    const avgEntryPremium = totalEntryContracts > 0
      ? weightedEntryPremium / totalEntryContracts : null;

    // Weighted average exit premium
    let totalExitContracts = 0;
    let weightedExitPremium = 0;
    let totalExitFees = 0;
    let latestExit: string | null = null;

    for (const e of exits) {
      const c = e.contracts || 1;
      const p = e.premium?.premiumPerShare || 0;
      totalExitContracts += c;
      weightedExitPremium += p * c;
      totalExitFees += e.fees;
      if (e.dateTime && (!latestExit || e.dateTime > latestExit)) {
        latestExit = e.dateTime;
      }
    }

    const avgExitPremium = totalExitContracts > 0
      ? weightedExitPremium / totalExitContracts : null;

    const firstEntry = entries[0];
    const status: OptionTradeStatus = exits.length > 0 ? "closed" : "open";
    const allRows = [...entries, ...exits];
    const allErrors = allRows.flatMap(r => r.errors);
    const allWarnings = allRows.flatMap(r => r.warnings);

    if (entries.length > 1) allWarnings.push(`Grouped ${entries.length} entry fills`);
    if (exits.length > 1) allWarnings.push(`Grouped ${exits.length} exit fills`);

    // Calculate realized PnL
    let realizedPnl: number | null = null;
    if (status === "closed" && avgEntryPremium != null && avgExitPremium != null) {
      const mult = firstEntry.multiplier;
      const contracts = Math.min(totalEntryContracts, totalExitContracts);
      const isLong = firstEntry.action?.positionSide === "long";
      if (isLong) {
        realizedPnl = (avgExitPremium - avgEntryPremium) * mult * contracts - totalEntryFees - totalExitFees;
      } else {
        realizedPnl = (avgEntryPremium - avgExitPremium) * mult * contracts - totalEntryFees - totalExitFees;
      }
    }
    // Use CSV-provided PnL if available and we couldn't calculate
    if (realizedPnl == null) {
      const pnlRow = allRows.find(r => r.pnl != null);
      if (pnlRow) realizedPnl = pnlRow.pnl;
    }

    trades.push({
      id: crypto.randomUUID(),
      underlyingTicker: firstEntry.underlyingTicker || "UNKNOWN",
      optionType: firstEntry.optionType || "call",
      strikePrice: firstEntry.strikePrice || 0,
      expirationDate: firstEntry.expirationDate || "",
      positionSide: firstEntry.action?.positionSide || "long",
      contracts: totalEntryContracts,
      multiplier: firstEntry.multiplier,
      entryPremium: avgEntryPremium,
      exitPremium: avgExitPremium,
      entryDateTime: earliestEntry,
      exitDateTime: latestExit,
      entryFees: totalEntryFees,
      exitFees: totalExitFees,
      realizedPnl,
      iv: firstEntry.iv,
      delta: firstEntry.delta,
      gamma: firstEntry.gamma,
      theta: firstEntry.theta,
      vega: firstEntry.vega,
      rho: firstEntry.rho,
      underlyingPrice: firstEntry.underlyingPrice,
      orderId: firstEntry.orderId,
      status,
      sourceRows: allRows,
      errors: allErrors,
      warnings: allWarnings,
      isValid: allErrors.length === 0,
      isDuplicate: false,
    });
  }

  // Handle orphaned exit rows (no matching entry)
  for (const [key, exits] of exitMap) {
    if (processedExitKeys.has(key)) continue;
    for (const exit of exits) {
      trades.push({
        id: crypto.randomUUID(),
        underlyingTicker: exit.underlyingTicker || "UNKNOWN",
        optionType: exit.optionType || "call",
        strikePrice: exit.strikePrice || 0,
        expirationDate: exit.expirationDate || "",
        positionSide: exit.action?.positionSide || "long",
        contracts: exit.contracts || 1,
        multiplier: exit.multiplier,
        entryPremium: null,
        exitPremium: exit.premium?.premiumPerShare || null,
        entryDateTime: null,
        exitDateTime: exit.dateTime,
        entryFees: 0,
        exitFees: exit.fees,
        realizedPnl: exit.pnl,
        iv: exit.iv, delta: exit.delta, gamma: exit.gamma,
        theta: exit.theta, vega: exit.vega, rho: exit.rho,
        underlyingPrice: exit.underlyingPrice,
        orderId: exit.orderId,
        status: "closed",
        sourceRows: [exit],
        errors: [],
        warnings: ["Exit row without matching entry — entry premium unknown"],
        isValid: true,
        isDuplicate: false,
      });
    }
  }

  return trades;
}

/**
 * Detect duplicates within parsed rows using fingerprinting
 */
export function markDuplicates(rows: ParsedOptionsRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const fp = fingerprintRow(row);
    if (seen.has(fp)) {
      row.isDuplicate = true;
      row.warnings.push("Duplicate row detected");
    } else {
      seen.add(fp);
    }
  }
}

/**
 * Check against existing trade fingerprints from the database
 */
export function markExistingDuplicates(
  rows: ParsedOptionsRow[],
  existingFingerprints: Set<string>,
): void {
  for (const row of rows) {
    const fp = fingerprintRow(row);
    if (existingFingerprints.has(fp)) {
      row.isDuplicate = true;
      row.warnings.push("Trade already exists in journal");
    }
  }
}
