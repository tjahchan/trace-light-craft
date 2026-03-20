/**
 * Options Engine — Validation Layer
 *
 * Schema-based validation that returns structured errors and warnings.
 */

import type { OptionLegInput, ValidationResult } from "./types";

export function validateOptionLeg(
  input: Partial<OptionLegInput>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Required fields
  if (!input.optionType) errors.push("Option type (Call/Put) is required");
  if (!input.positionSide) errors.push("Position direction (Long/Short) is required");

  // ── Numeric positivity
  if (input.strikePrice == null || input.strikePrice <= 0)
    errors.push("Strike price must be positive");

  if (input.entryPremium == null || input.entryPremium < 0)
    errors.push("Entry premium cannot be negative");

  if (input.contracts == null || input.contracts <= 0 || !Number.isInteger(input.contracts))
    errors.push("Number of contracts must be a positive integer");

  if (input.multiplier != null && input.multiplier <= 0)
    errors.push("Contract multiplier must be positive");

  // ── Exit premium
  if (input.exitPremium != null && input.exitPremium < 0)
    errors.push("Exit premium cannot be negative");

  // ── Current premium
  if (input.currentPremium != null && input.currentPremium < 0)
    errors.push("Current premium cannot be negative");

  // ── Fees
  if (input.entryFees != null && input.entryFees < 0)
    errors.push("Entry fees cannot be negative");
  if (input.exitFees != null && input.exitFees < 0)
    errors.push("Exit fees cannot be negative");

  // ── Status-specific
  if (input.status === "closed") {
    if (input.exitPremium == null)
      errors.push("Exit premium is required for closed trades");
    if (!input.exitDateTime)
      warnings.push("Exit date/time recommended for closed trades");
  }

  if (input.status === "open") {
    if (input.currentPremium == null)
      warnings.push("No current premium provided — unrealized P&L will be unavailable");
  }

  if (input.status === "expired_worthless") {
    // Exit premium defaults to 0 — no error needed
  }

  // ── Dates
  if (input.expirationDate) {
    const exp = new Date(input.expirationDate);
    if (isNaN(exp.getTime())) errors.push("Expiration date is invalid");
  }

  if (input.entryDateTime) {
    const entry = new Date(input.entryDateTime);
    if (isNaN(entry.getTime())) errors.push("Entry date/time is invalid");
  }

  if (input.exitDateTime) {
    const exit = new Date(input.exitDateTime);
    if (isNaN(exit.getTime())) errors.push("Exit date/time is invalid");
  }

  if (input.entryDateTime && input.exitDateTime) {
    if (new Date(input.entryDateTime) > new Date(input.exitDateTime)) {
      warnings.push("Exit date/time is before entry date/time");
    }
  }

  if (
    input.status === "open" &&
    input.expirationDate &&
    new Date(input.expirationDate) < new Date()
  ) {
    warnings.push("Expiration date has already passed but trade is marked Open");
  }

  // ── Capital / margin
  if (input.capitalAtRisk != null && input.capitalAtRisk <= 0)
    errors.push("Capital at risk must be positive if provided");

  if (input.marginUsed != null && input.marginUsed <= 0)
    errors.push("Margin used must be positive if provided");

  // ── Underlying prices
  if (input.underlyingPriceCurrent != null && input.underlyingPriceCurrent <= 0)
    warnings.push("Current underlying price should be positive");

  // ── IV
  if (input.entryIV != null && input.entryIV < 0)
    warnings.push("Entry IV should be non-negative");
  if (input.exitIV != null && input.exitIV < 0)
    warnings.push("Exit IV should be non-negative");

  // ── Greeks plausibility
  if (input.delta != null && (input.delta < -1.5 || input.delta > 1.5))
    warnings.push("Delta value seems unusual (expected between -1 and 1)");
  if (input.gamma != null && input.gamma < -1)
    warnings.push("Gamma value seems unusual");
  if (input.theta != null && Math.abs(input.theta) > 50)
    warnings.push("Theta value seems unusually large");
  if (input.vega != null && Math.abs(input.vega) > 100)
    warnings.push("Vega value seems unusually large");

  // ── Short return basis warning
  if (
    input.positionSide === "short" &&
    input.capitalAtRisk == null &&
    input.marginUsed == null &&
    input.status !== "open"
  ) {
    warnings.push(
      "Short trade without Capital at Risk or Margin — return % will use premium collected as an approximation",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick check: are minimum required fields present for calculation?
 * Does NOT validate — just checks availability.
 */
export function canCalculate(input: Partial<OptionLegInput>): boolean {
  return !!(
    input.optionType &&
    input.positionSide &&
    input.strikePrice &&
    input.strikePrice > 0 &&
    input.entryPremium != null &&
    input.entryPremium >= 0 &&
    input.contracts &&
    input.contracts > 0
  );
}
