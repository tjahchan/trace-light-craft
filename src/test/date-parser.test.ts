import { describe, it, expect } from "vitest";
import {
  parseImportedDate,
  analyzeColumnDateFormat,
  parseDateColumn,
  validateDateRange,
} from "@/lib/options/csv-import/date-parser";

describe("Date Parser — Single Value Parsing", () => {
  it("parses ISO format YYYY-MM-DD HH:mm:ss", () => {
    const r = parseImportedDate("2026-02-19 11:29:18");
    expect(r.normalizedValue).toBe("2026-02-19T11:29:18");
    expect(r.confidence).toBe("high");
    expect(r.ambiguityFlag).toBe(false);
  });

  it("parses ISO with T separator and Z", () => {
    const r = parseImportedDate("2026-02-19T11:29:18Z");
    expect(r.normalizedValue).toBe("2026-02-19T11:29:18");
    expect(r.confidence).toBe("high");
  });

  it("parses unambiguous DD/MM/YYYY (day > 12)", () => {
    const r = parseImportedDate("19/02/2026 11:29:18");
    expect(r.normalizedValue).toBe("2026-02-19T11:29:18");
    expect(r.formatFamily).toBe("DMY");
    expect(r.confidence).toBe("high");
  });

  it("parses unambiguous MM/DD/YYYY (second > 12)", () => {
    const r = parseImportedDate("02/19/2026 11:29:18");
    expect(r.normalizedValue).toBe("2026-02-19T11:29:18");
    expect(r.formatFamily).toBe("MDY");
    expect(r.confidence).toBe("high");
  });

  it("flags ambiguous dates with both tokens <= 12", () => {
    const r = parseImportedDate("03/04/2026 11:29:18");
    expect(r.ambiguityFlag).toBe(true);
    expect(r.confidence).toBe("low");
    expect(r.candidateFormats).toBeDefined();
    expect(r.candidateFormats!.length).toBeGreaterThan(1);
  });

  it("parses date-only values", () => {
    const r = parseImportedDate("2026-06-21");
    expect(r.normalizedValue).toBe("2026-06-21");
    expect(r.confidence).toBe("high");
  });

  it("parses 12-hour AM/PM format", () => {
    const r = parseImportedDate("02/19/2026 03:08:06 AM");
    expect(r.normalizedValue).toBe("2026-02-19T03:08:06");
  });

  it("converts PM correctly", () => {
    const r = parseImportedDate("02/19/2026 01:30:00 PM");
    expect(r.normalizedValue).toBe("2026-02-19T13:30:00");
  });

  it("handles 2-digit years", () => {
    const r = parseImportedDate("2/19/26 11:29 AM");
    expect(r.normalizedValue).toBe("2026-02-19T11:29:00");
  });

  it("handles missing seconds", () => {
    const r = parseImportedDate("19-02-2026 11:29");
    expect(r.normalizedValue).toBe("2026-02-19T11:29:00");
  });

  it("fails cleanly on invalid date 31/02/2026", () => {
    const r = parseImportedDate("31/02/2026 11:29:18");
    expect(r.confidence).toBe("failed");
    expect(r.normalizedValue).toBeNull();
  });

  it("fails on nonsense 19/19/2026", () => {
    const r = parseImportedDate("19/19/2026 11:29:18");
    expect(r.confidence).toBe("failed");
    expect(r.normalizedValue).toBeNull();
  });

  it("fails on random text", () => {
    const r = parseImportedDate("hello world");
    expect(r.confidence).toBe("failed");
  });

  it("handles empty/null", () => {
    expect(parseImportedDate("").confidence).toBe("failed");
    expect(parseImportedDate(null).confidence).toBe("failed");
    expect(parseImportedDate(undefined).confidence).toBe("failed");
  });

  it("parses dot-separated dates", () => {
    const r = parseImportedDate("19.02.2026 11:29:18");
    expect(r.normalizedValue).toBe("2026-02-19T11:29:18");
    expect(r.formatFamily).toBe("DMY");
  });
});

describe("Date Parser — Column-Level Inference", () => {
  it("infers DMY when any row has day > 12", () => {
    const values = [
      "19/02/2026 11:29:18",
      "05/03/2026 03:08:06",
      "06/03/2026 17:26:05",
    ];
    const analysis = analyzeColumnDateFormat(values);
    expect(analysis.inferredFamily).toBe("DMY");
    expect(analysis.confidence).toBe("high");
    expect(analysis.requiresUserReview).toBe(false);
  });

  it("infers MDY when any row has second token > 12", () => {
    const values = [
      "02/19/2026 11:29:18",
      "03/15/2026 03:08:06",
    ];
    const analysis = analyzeColumnDateFormat(values);
    expect(analysis.inferredFamily).toBe("MDY");
    expect(analysis.confidence).toBe("high");
  });

  it("detects ISO columns", () => {
    const values = [
      "2026-02-19 11:29:18",
      "2026-03-06T17:26:05Z",
    ];
    const analysis = analyzeColumnDateFormat(values);
    expect(analysis.inferredFamily).toBe("YMD");
    expect(analysis.confidence).toBe("high");
  });

  it("flags all-ambiguous columns for review", () => {
    const values = [
      "03/04/2026 11:29:18",
      "04/05/2026 12:00:00",
    ];
    const analysis = analyzeColumnDateFormat(values);
    expect(analysis.requiresUserReview).toBe(true);
  });

  it("respects user override", () => {
    const values = ["03/04/2026"];
    const analysis = analyzeColumnDateFormat(values, "DMY");
    expect(analysis.inferredFamily).toBe("DMY");
    expect(analysis.confidence).toBe("high");
    expect(analysis.disambiguatedBy).toBe("user_override");
  });
});

describe("Date Parser — Column-Aware Row Parsing", () => {
  it("resolves ambiguous dates using column context", () => {
    const values = [
      "19/02/2026 11:29:18", // unambiguously DMY
      "03/04/2026 11:29:18", // ambiguous but column is DMY
    ];
    const { results } = parseDateColumn(values);
    expect(results[0].normalizedValue).toBe("2026-02-19T11:29:18");
    expect(results[1].normalizedValue).toBe("2026-04-03T11:29:18"); // DD/MM → April 3
  });

  it("handles user override for column parsing", () => {
    const values = ["03/04/2026 11:29:18"];
    const { results } = parseDateColumn(values, "MDY");
    expect(results[0].normalizedValue).toBe("2026-03-04T11:29:18"); // March 4
  });
});

describe("Date Parser — Date Range Validation", () => {
  it("accepts valid range", () => {
    const r = validateDateRange("2026-02-19T11:00:00", "2026-02-19T12:00:00");
    expect(r.valid).toBe(true);
  });

  it("rejects close before open", () => {
    const r = validateDateRange("2026-02-19T12:00:00", "2026-02-19T11:00:00");
    expect(r.valid).toBe(false);
    expect(r.warning).toContain("before");
  });

  it("accepts when either is null", () => {
    expect(validateDateRange(null, "2026-02-19T12:00:00").valid).toBe(true);
    expect(validateDateRange("2026-02-19T12:00:00", null).valid).toBe(true);
  });
});
