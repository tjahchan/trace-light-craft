/**
 * Options CSV Import — Main Pipeline
 *
 * Orchestrates: CSV parse → detect broker → map headers → analyze dates →
 * parse rows → detect duplicates → group into trades → validate → produce report
 */

export { parseOptionSymbol, looksLikeOptionSymbol } from "./symbol-parser";
export { normalizeAction } from "./action-normalizer";
export { mapCsvHeaders, getAvailableFields } from "./header-mapper";
export { normalizePremium, cleanNumeric } from "./premium-normalizer";
export { detectBrokerFormat } from "./broker-detector";
export { parseRow } from "./row-parser";
export { groupExecutionsIntoTrades, markDuplicates, markExistingDuplicates, fingerprintRow } from "./trade-grouper";
export { parseImportedDate, parseDateColumn, analyzeColumnDateFormat, validateDateRange, describeFormat } from "./date-parser";
export type { DateParseResult, ColumnDateAnalysis, DateFormatOverride, DateConfidence } from "./date-parser";
export * from "./types";

import type { ColumnMapping, ImportReport, ParsedOptionsRow, GroupedTrade, OptionsField } from "./types";
import type { ColumnDateAnalysis, DateFormatOverride } from "./date-parser";
import { analyzeColumnDateFormat } from "./date-parser";
import { detectBrokerFormat } from "./broker-detector";
import { mapCsvHeaders } from "./header-mapper";
import { parseRow } from "./row-parser";
import { markDuplicates, groupExecutionsIntoTrades } from "./trade-grouper";

/**
 * Parse raw CSV text into headers + rows
 */
export function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Simple CSV parser handling quoted fields
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1)
    .filter(l => l.trim().length > 0)
    .map(parseLine)
    .filter(r => r.some(c => c.trim().length > 0)); // Skip empty rows

  return { headers, rows };
}

/**
 * Extract values for a mapped field from rows
 */
function getColumnValues(rows: string[][], mappings: ColumnMapping[], field: OptionsField): (string | null)[] {
  const mapping = mappings.find(m => m.mappedField === field);
  if (!mapping) return [];
  return rows.map(row => row[mapping.csvColumnIndex]?.trim() || null);
}

/**
 * Run the full import pipeline
 */
export function runImportPipeline(
  headers: string[],
  rows: string[][],
  mappingOverrides?: Record<number, OptionsField>,
  dateFormatOverrides?: Record<string, DateFormatOverride>,
): {
  mappings: ColumnMapping[];
  parsedRows: ParsedOptionsRow[];
  groupedTrades: GroupedTrade[];
  report: ImportReport;
  dateAnalysis: Record<string, ColumnDateAnalysis>;
} {
  // 1. Detect broker
  const detection = detectBrokerFormat(headers, rows.slice(0, 10));

  // 2. Auto-map headers
  let mappings = mapCsvHeaders(headers, rows.slice(0, 10));

  // 3. Apply user overrides
  if (mappingOverrides) {
    mappings = mappings.map(m => {
      if (mappingOverrides[m.csvColumnIndex] !== undefined) {
        return { ...m, mappedField: mappingOverrides[m.csvColumnIndex], confidence: "high" as const };
      }
      return m;
    });
  }

  // 4. Analyze date columns before row parsing
  const dateFields: OptionsField[] = ["date", "time", "dateTime", "expiration"];
  const dateAnalysis: Record<string, ColumnDateAnalysis> = {};
  for (const field of dateFields) {
    const values = getColumnValues(rows, mappings, field);
    if (values.length > 0 && values.some(v => v !== null)) {
      const override = dateFormatOverrides?.[field];
      dateAnalysis[field] = analyzeColumnDateFormat(values, override);
    }
  }

  // 5. Parse each row with date context
  const parsedRows: ParsedOptionsRow[] = rows.map((row, i) =>
    parseRow(row, i, headers, mappings, dateAnalysis)
  );

  // 6. Detect internal duplicates
  markDuplicates(parsedRows);

  // 7. Group into trades
  const groupedTrades = groupExecutionsIntoTrades(parsedRows);

  // 8. Build report
  const report: ImportReport = {
    totalRows: rows.length,
    optionsRows: parsedRows.filter(r => r.optionType != null).length,
    importedCount: groupedTrades.filter(t => t.isValid && !t.isDuplicate).length,
    duplicateCount: parsedRows.filter(r => r.isDuplicate).length,
    warningCount: groupedTrades.filter(t => t.warnings.length > 0).length,
    failedCount: groupedTrades.filter(t => !t.isValid).length,
    detectedBroker: detection.broker,
    importBatchId: crypto.randomUUID(),
    trades: groupedTrades,
  };

  return { mappings, parsedRows, groupedTrades, report, dateAnalysis };
}
