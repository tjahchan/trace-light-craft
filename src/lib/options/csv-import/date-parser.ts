/**
 * Options CSV Import — Production-Grade Date Parser
 *
 * Deterministic date parsing with column-level inference, format detection,
 * confidence scoring, and ambiguity flagging. Never relies on native Date parsing
 * for format detection.
 */

// ─── Types ────────────────────────────────────────────────────

export type DateFormatFamily = "ISO" | "DMY" | "MDY" | "YMD" | "unknown";
export type DateConfidence = "high" | "medium" | "low" | "failed";

export interface DateParseResult {
  rawValue: string;
  detectedFormat: string | null;
  formatFamily: DateFormatFamily;
  normalizedValue: string | null; // ISO string YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD
  confidence: DateConfidence;
  ambiguityFlag: boolean;
  candidateFormats?: string[];
  error?: string;
}

export interface ColumnDateAnalysis {
  inferredFamily: DateFormatFamily;
  inferredFormat: string | null;
  confidence: DateConfidence;
  mixedFormatDetected: boolean;
  requiresUserReview: boolean;
  sampleSize: number;
  disambiguatedBy: "impossible_values" | "column_majority" | "iso_detected" | "user_override" | "unresolved" | null;
}

export type DateFormatOverride = "auto" | "DMY" | "MDY" | "ISO";

// ─── Tokenizer ────────────────────────────────────────────────

interface DateTokens {
  parts: number[];       // numeric date parts [a, b, c]
  separator: string;     // / - .
  hour: number | null;
  minute: number | null;
  second: number | null;
  ampm: "am" | "pm" | null;
  hasTimezone: boolean;
  raw: string;
  dateOnly: boolean;
  yearPosition: 0 | 2 | -1; // 0=first, 2=last, -1=unknown
}

function tokenize(raw: string): DateTokens | null {
  const s = raw.trim().replace(/^#+/, "").replace(/^'+/, "").trim();
  if (!s) return null;

  // Strip trailing Z or timezone offset
  let hasTimezone = false;
  let working = s;
  if (/Z$/i.test(working)) {
    hasTimezone = true;
    working = working.replace(/Z$/i, "").trim();
  } else if (/[+-]\d{2}:\d{2}$/.test(working)) {
    hasTimezone = true;
    working = working.replace(/[+-]\d{2}:\d{2}$/, "").trim();
  }

  // Split date and time on space or T
  const dtSplit = working.split(/[T\s]+/);
  const datePart = dtSplit[0];
  const timePart = dtSplit.length > 1 ? dtSplit.slice(1).join(" ") : null;

  // Detect separator and split date
  const sepMatch = datePart.match(/[\/\-\.]/);
  const separator = sepMatch ? sepMatch[0] : "";
  const datePieces = separator ? datePart.split(separator) : [datePart];

  if (datePieces.length < 3) return null;

  const numParts = datePieces.map(p => {
    const n = parseInt(p, 10);
    return isNaN(n) ? -1 : n;
  });
  if (numParts.some(n => n < 0)) return null;

  // Detect year position
  let yearPosition: 0 | 2 | -1 = -1;
  if (datePieces[0].length === 4 || numParts[0] > 31) yearPosition = 0;
  else if (datePieces[2].length === 4 || numParts[2] > 31) yearPosition = 2;
  else if (datePieces[2].length === 2) yearPosition = 2; // 2-digit year at end is common

  // Parse time
  let hour: number | null = null;
  let minute: number | null = null;
  let second: number | null = null;
  let ampm: "am" | "pm" | null = null;

  if (timePart) {
    const ampmMatch = timePart.match(/\b(am|pm)\b/i);
    if (ampmMatch) ampm = ampmMatch[1].toLowerCase() as "am" | "pm";

    const timeClean = timePart.replace(/\s*(am|pm)\s*/i, "").trim();
    const timePieces = timeClean.split(":");
    hour = parseInt(timePieces[0], 10);
    minute = timePieces.length > 1 ? parseInt(timePieces[1], 10) : 0;
    second = timePieces.length > 2 ? parseInt(timePieces[2], 10) : 0;

    if (isNaN(hour)) hour = null;
    if (isNaN(minute!)) minute = 0;
    if (isNaN(second!)) second = 0;

    // Convert 12h to 24h
    if (ampm && hour !== null) {
      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
    }
  }

  return {
    parts: numParts,
    separator,
    hour,
    minute,
    second,
    ampm,
    hasTimezone,
    raw: s,
    dateOnly: timePart === null,
    yearPosition,
  };
}

// ─── Expand 2-digit years ─────────────────────────────────────

function expandYear(y: number): number {
  if (y >= 100) return y;
  return y >= 70 ? 1900 + y : 2000 + y;
}

// ─── Validate a date ──────────────────────────────────────────

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

// ─── Format family detection for a single token set ───────────

interface Interpretation {
  family: DateFormatFamily;
  format: string;
  year: number;
  month: number;
  day: number;
}

function getInterpretations(tokens: DateTokens): Interpretation[] {
  const results: Interpretation[] = [];
  const [a, b, c] = tokens.parts;
  const sep = tokens.separator;
  const timeSuffix = tokens.dateOnly ? "" : ` HH:mm:ss`;

  if (tokens.yearPosition === 0) {
    // Year-first: YYYY-MM-DD
    const year = expandYear(a);
    if (isValidDate(year, b, c)) {
      results.push({ family: "YMD", format: `YYYY${sep}MM${sep}DD${timeSuffix}`, year, month: b, day: c });
    }
  } else if (tokens.yearPosition === 2) {
    const year = expandYear(c);
    // DMY: DD/MM/YYYY
    if (isValidDate(year, b, a)) {
      results.push({ family: "DMY", format: `DD${sep}MM${sep}YYYY${timeSuffix}`, year, month: b, day: a });
    }
    // MDY: MM/DD/YYYY
    if (isValidDate(year, a, b)) {
      results.push({ family: "MDY", format: `MM${sep}DD${sep}YYYY${timeSuffix}`, year, month: a, day: b });
    }
  } else {
    // Unknown year position — try all 3
    const yearA = expandYear(a);
    if (isValidDate(yearA, b, c)) {
      results.push({ family: "YMD", format: `YYYY${sep}MM${sep}DD${timeSuffix}`, year: yearA, month: b, day: c });
    }
    const yearC = expandYear(c);
    if (isValidDate(yearC, b, a)) {
      results.push({ family: "DMY", format: `DD${sep}MM${sep}YYYY${timeSuffix}`, year: yearC, month: b, day: a });
    }
    if (isValidDate(yearC, a, b)) {
      results.push({ family: "MDY", format: `MM${sep}DD${sep}YYYY${timeSuffix}`, year: yearC, month: a, day: b });
    }
  }

  return results;
}

// ─── Build ISO string from components ─────────────────────────

function toISO(year: number, month: number, day: number, tokens: DateTokens): string {
  const yy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  if (tokens.dateOnly && tokens.hour === null) {
    return `${yy}-${mm}-${dd}`;
  }

  const h = String(tokens.hour ?? 0).padStart(2, "0");
  const m = String(tokens.minute ?? 0).padStart(2, "0");
  const s = String(tokens.second ?? 0).padStart(2, "0");
  return `${yy}-${mm}-${dd}T${h}:${m}:${s}`;
}

// ─── Column-Level Format Inference ────────────────────────────

export function analyzeColumnDateFormat(
  values: (string | null | undefined)[],
  override?: DateFormatOverride,
): ColumnDateAnalysis {
  if (override && override !== "auto") {
    const familyMap: Record<string, DateFormatFamily> = { DMY: "DMY", MDY: "MDY", ISO: "ISO" };
    return {
      inferredFamily: familyMap[override] || "unknown",
      inferredFormat: null,
      confidence: "high",
      mixedFormatDetected: false,
      requiresUserReview: false,
      sampleSize: values.length,
      disambiguatedBy: "user_override",
    };
  }

  const cleaned = values.filter((v): v is string => !!v && v.trim().length > 0);
  if (cleaned.length === 0) {
    return { inferredFamily: "unknown", inferredFormat: null, confidence: "failed", mixedFormatDetected: false, requiresUserReview: false, sampleSize: 0, disambiguatedBy: null };
  }

  // Tally which families are possible per row
  const familyCounts: Record<DateFormatFamily, number> = { ISO: 0, DMY: 0, MDY: 0, YMD: 0, unknown: 0 };
  const onlyDMY: number[] = []; // row indices where only DMY is valid
  const onlyMDY: number[] = [];
  let isoCount = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const tokens = tokenize(cleaned[i]);
    if (!tokens) { familyCounts.unknown++; continue; }

    // Quick ISO detection
    if (tokens.yearPosition === 0) {
      isoCount++;
      familyCounts.YMD++;
      continue;
    }

    const interps = getInterpretations(tokens);
    const families = new Set(interps.map(ip => ip.family));

    if (families.size === 0) { familyCounts.unknown++; continue; }

    for (const f of families) familyCounts[f]++;

    if (families.has("DMY") && !families.has("MDY")) onlyDMY.push(i);
    if (families.has("MDY") && !families.has("DMY")) onlyMDY.push(i);
  }

  // Decision logic
  const total = cleaned.length;

  // If majority ISO/YMD
  if (isoCount > total * 0.7) {
    return { inferredFamily: "YMD", inferredFormat: "YYYY-MM-DD", confidence: "high", mixedFormatDetected: false, requiresUserReview: false, sampleSize: total, disambiguatedBy: "iso_detected" };
  }

  // If any row is unambiguously DMY (first token > 12), the whole column is DMY
  if (onlyDMY.length > 0 && onlyMDY.length === 0) {
    return { inferredFamily: "DMY", inferredFormat: "DD/MM/YYYY", confidence: "high", mixedFormatDetected: false, requiresUserReview: false, sampleSize: total, disambiguatedBy: "impossible_values" };
  }

  // If any row is unambiguously MDY (second token > 12), the whole column is MDY
  if (onlyMDY.length > 0 && onlyDMY.length === 0) {
    return { inferredFamily: "MDY", inferredFormat: "MM/DD/YYYY", confidence: "high", mixedFormatDetected: false, requiresUserReview: false, sampleSize: total, disambiguatedBy: "impossible_values" };
  }

  // Conflicting unambiguous rows = mixed format
  if (onlyDMY.length > 0 && onlyMDY.length > 0) {
    return { inferredFamily: "unknown", inferredFormat: null, confidence: "low", mixedFormatDetected: true, requiresUserReview: true, sampleSize: total, disambiguatedBy: "unresolved" };
  }

  // All rows are ambiguous (both tokens <= 12) — use majority heuristic
  if (familyCounts.DMY >= familyCounts.MDY) {
    return { inferredFamily: "DMY", inferredFormat: "DD/MM/YYYY", confidence: "low", mixedFormatDetected: false, requiresUserReview: true, sampleSize: total, disambiguatedBy: "column_majority" };
  }

  return { inferredFamily: "MDY", inferredFormat: "MM/DD/YYYY", confidence: "low", mixedFormatDetected: false, requiresUserReview: true, sampleSize: total, disambiguatedBy: "column_majority" };
}

// ─── Single Value Parser ──────────────────────────────────────

export function parseImportedDate(
  rawValue: string | null | undefined,
  columnAnalysis?: ColumnDateAnalysis,
): DateParseResult {
  if (!rawValue || !rawValue.trim()) {
    return { rawValue: rawValue || "", detectedFormat: null, formatFamily: "unknown", normalizedValue: null, confidence: "failed", ambiguityFlag: false, error: "Empty date value" };
  }

  const raw = rawValue.trim();
  const tokens = tokenize(raw);

  if (!tokens) {
    return { rawValue: raw, detectedFormat: null, formatFamily: "unknown", normalizedValue: null, confidence: "failed", ambiguityFlag: false, error: "Could not parse date structure" };
  }

  const interps = getInterpretations(tokens);

  if (interps.length === 0) {
    return { rawValue: raw, detectedFormat: null, formatFamily: "unknown", normalizedValue: null, confidence: "failed", ambiguityFlag: false, error: `Invalid date components: ${tokens.parts.join("/")}` };
  }

  // If column analysis provides a family, filter to that
  if (columnAnalysis && columnAnalysis.inferredFamily !== "unknown") {
    const preferred = interps.find(ip => ip.family === columnAnalysis.inferredFamily || (columnAnalysis.inferredFamily === "ISO" && ip.family === "YMD"));
    if (preferred) {
      return {
        rawValue: raw,
        detectedFormat: preferred.format,
        formatFamily: preferred.family,
        normalizedValue: toISO(preferred.year, preferred.month, preferred.day, tokens),
        confidence: columnAnalysis.confidence,
        ambiguityFlag: columnAnalysis.confidence === "low",
      };
    }
  }

  // Single interpretation = unambiguous
  if (interps.length === 1) {
    const ip = interps[0];
    return {
      rawValue: raw,
      detectedFormat: ip.format,
      formatFamily: ip.family,
      normalizedValue: toISO(ip.year, ip.month, ip.day, tokens),
      confidence: "high",
      ambiguityFlag: false,
    };
  }

  // Multiple interpretations = ambiguous, pick first but flag
  const primary = interps[0];
  return {
    rawValue: raw,
    detectedFormat: "ambiguous",
    formatFamily: primary.family,
    normalizedValue: toISO(primary.year, primary.month, primary.day, tokens),
    confidence: "low",
    ambiguityFlag: true,
    candidateFormats: interps.map(ip => ip.format),
  };
}

// ─── Batch parse with column inference ────────────────────────

export function parseDateColumn(
  values: (string | null | undefined)[],
  override?: DateFormatOverride,
): { analysis: ColumnDateAnalysis; results: DateParseResult[] } {
  const analysis = analyzeColumnDateFormat(values, override);
  const results = values.map(v => parseImportedDate(v, analysis));
  return { analysis, results };
}

// ─── Validation helpers ───────────────────────────────────────

export function validateDateRange(
  openTime: string | null,
  closeTime: string | null,
): { valid: boolean; warning?: string } {
  if (!openTime || !closeTime) return { valid: true };
  const open = new Date(openTime);
  const close = new Date(closeTime);
  if (isNaN(open.getTime()) || isNaN(close.getTime())) {
    return { valid: false, warning: "Invalid date values for range check" };
  }
  if (close < open) {
    return { valid: false, warning: "Close time is before open time" };
  }
  return { valid: true };
}

// ─── Format description for UI ────────────────────────────────

export function describeFormat(analysis: ColumnDateAnalysis): string {
  if (analysis.confidence === "failed") return "Could not detect date format";
  const fmt = analysis.inferredFormat || analysis.inferredFamily;
  const conf = analysis.confidence;
  if (analysis.requiresUserReview) {
    return `Detected ${fmt} format (${conf} confidence) — please confirm`;
  }
  return `Detected ${fmt} format (${conf} confidence)`;
}
