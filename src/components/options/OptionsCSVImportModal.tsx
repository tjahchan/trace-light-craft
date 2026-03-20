import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Upload, AlertCircle, CheckCircle2, AlertTriangle, FileText, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  parseCSVText,
  runImportPipeline,
  getAvailableFields,
  describeFormat,
  type ColumnMapping,
  type GroupedTrade,
  type ImportReport,
  type OptionsField,
  type ParsedOptionsRow,
  type ColumnDateAnalysis,
  type DateFormatOverride,
} from "@/lib/options/csv-import";

interface OptionsCSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onImportComplete?: () => void;
}

type Step = "upload" | "mapping" | "preview" | "report";

export function OptionsCSVImportModal({
  open,
  onOpenChange,
  accountId,
  onImportComplete,
}: OptionsCSVImportModalProps) {
  const { user } = useAuth();
  const { checkAndIncrementUsage, triggerUpgrade, csvImportsUsed, csvLimit, isPro } = usePlan();

  const [step, setStep] = useState<Step>("upload");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [mappingOverrides, setMappingOverrides] = useState<Record<number, OptionsField>>({});
  const [parsedRows, setParsedRows] = useState<ParsedOptionsRow[]>([]);
  const [groupedTrades, setGroupedTrades] = useState<GroupedTrade[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const availableFields = useMemo(() => getAvailableFields(), []);

  const reset = () => {
    setStep("upload");
    setRawHeaders([]);
    setRawRows([]);
    setFileName("");
    setMappings([]);
    setMappingOverrides({});
    setParsedRows([]);
    setGroupedTrades([]);
    setReport(null);
    setImporting(false);
    setSearchFilter("");
  };

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSVText(text);
      setRawHeaders(headers);
      setRawRows(rows);
      setFileName(file.name);

      // Run initial pipeline with auto-mapping
      const result = runImportPipeline(headers, rows);
      setMappings(result.mappings);
      setStep("mapping");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleMappingChange = (colIndex: number, field: OptionsField) => {
    setMappingOverrides(prev => ({ ...prev, [colIndex]: field }));
  };

  const proceedToPreview = () => {
    const result = runImportPipeline(rawHeaders, rawRows, mappingOverrides);
    setMappings(result.mappings);
    setParsedRows(result.parsedRows);
    setGroupedTrades(result.groupedTrades);
    setReport(result.report);
    setStep("preview");
  };

  const handleImport = async () => {
    if (!user || !report) return;

    const usageResult = await checkAndIncrementUsage("csv");
    if (!usageResult.allowed) {
      triggerUpgrade("You've reached your monthly CSV import limit. Upgrade to Pro for unlimited imports.");
      return;
    }

    setImporting(true);
    const validTrades = groupedTrades.filter(t => t.isValid && !t.isDuplicate);
    let importedCount = 0;

    try {
      for (const trade of validTrades) {
        const tradeRecord = {
          user_id: user.id,
          account_id: accountId,
          symbol: `${trade.underlyingTicker} ${trade.strikePrice}${trade.optionType === "call" ? "C" : "P"}`,
          side: trade.positionSide === "long" ? "Long" : "Short",
          quantity: trade.contracts,
          entry_price: trade.entryPremium || 0,
          exit_price: trade.exitPremium || null,
          pnl: trade.realizedPnl || 0,
          status: trade.status === "open" ? "open" : "closed",
          open_time: trade.entryDateTime,
          close_time: trade.exitDateTime,
          commissions: trade.entryFees + trade.exitFees,
          trade_type: "options",
          option_type: trade.optionType,
          position_direction: trade.positionSide,
          strike_price: trade.strikePrice,
          expiration_date: trade.expirationDate,
          contract_multiplier: trade.multiplier,
          num_contracts: trade.contracts,
          entry_premium: trade.entryPremium,
          exit_premium: trade.exitPremium,
          underlying_ticker: trade.underlyingTicker,
          entry_fees: trade.entryFees,
          exit_fees: trade.exitFees,
          iv_entry: trade.iv,
          delta: trade.delta,
          gamma: trade.gamma,
          theta: trade.theta,
          vega: trade.vega,
          rho: trade.rho,
          underlying_price_entry: trade.underlyingPrice,
          strategy_label: "Single Leg",
          option_status: trade.status,
          note: `CSV Import: ${fileName} | Batch: ${report.importBatchId}`,
          tags: ["csv-import"],
        };

        const { error } = await supabase.from("trades").insert(tradeRecord as any);
        if (error) {
          console.error("[Options CSV Import] Insert error for trade:", trade.id, error);
        } else {
          importedCount++;
        }
      }

      toast.success(`✓ ${importedCount} options trades imported successfully`);
      setReport(prev => prev ? { ...prev, importedCount } : null);
      setStep("report");
      onImportComplete?.();
    } catch (err: any) {
      console.error("[Options CSV Import] Error:", err);
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const validCount = groupedTrades.filter(t => t.isValid && !t.isDuplicate).length;
  const invalidCount = groupedTrades.filter(t => !t.isValid).length;
  const duplicateCount = groupedTrades.filter(t => t.isDuplicate).length;
  const warningCount = groupedTrades.filter(t => t.warnings.length > 0 && t.isValid).length;

  const filteredTrades = useMemo(() => {
    if (!searchFilter) return groupedTrades;
    const lower = searchFilter.toLowerCase();
    return groupedTrades.filter(t =>
      t.underlyingTicker.toLowerCase().includes(lower) ||
      t.optionType.includes(lower) ||
      t.positionSide.includes(lower)
    );
  }, [groupedTrades, searchFilter]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onOpenChange(false); } else onOpenChange(v); }}>
      <DialogContent className={
        step === "upload"
          ? "backdrop-blur-xl bg-black/60 border-white/[0.1] max-w-2xl"
          : "backdrop-blur-xl bg-black/60 border-white/[0.1] w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] flex flex-col"
      }>
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {step === "upload" && "Import Options CSV"}
            {step === "mapping" && "Map Columns"}
            {step === "preview" && "Preview Import"}
            {step === "report" && "Import Complete"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {step === "upload" && "Upload a CSV file containing your options trades"}
            {step === "mapping" && `${rawHeaders.length} columns detected • ${rawRows.length} rows • Auto-mapped fields shown below`}
            {step === "preview" && `${validCount} trades ready • ${invalidCount} invalid • ${duplicateCount} duplicates`}
            {step === "report" && `Import batch ${report?.importBatchId.slice(0, 8)}...`}
          </DialogDescription>
        </DialogHeader>

        {/* ─── STEP 1: Upload ─── */}
        {step === "upload" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-white/[0.1] rounded-2xl p-12 text-center hover:border-white/[0.2] transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag & drop your options CSV, or click to browse
            </p>
            <p className="text-[10px] text-muted-foreground/60 mb-4">
              Supports Interactive Brokers, Thinkorswim, Tastytrade, Schwab, and generic formats
            </p>
            <label>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
              <Button variant="outline" className="glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground" asChild>
                <span>Choose File</span>
              </Button>
            </label>
            {!isPro && (
              <p className="text-[10px] text-muted-foreground/60 mt-3">
                {csvImportsUsed} / {csvLimit} imports used this month
              </p>
            )}
          </div>
        )}

        {/* ─── STEP 2: Mapping ─── */}
        {step === "mapping" && (
          <div className="flex-1 flex flex-col min-h-0">
            {report && (
              <div className="flex items-center gap-2 pb-3 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{report.detectedBroker !== "unknown" ? report.detectedBroker.replace("_", " ") : "Generic format"}</Badge>
                <span>•</span>
                <span>{fileName}</span>
              </div>
            )}

            <div className="flex-1 flex gap-6 min-h-0">
              {/* Left: Column mapping */}
              <div className="w-1/2 overflow-y-auto space-y-1.5 pr-2">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Column → Field Mapping</p>
                {mappings.map((m) => (
                  <div key={m.csvColumnIndex} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-white/[0.02]">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-foreground font-mono truncate block">{m.csvColumnName}</span>
                      {m.sampleValues.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/50 truncate block">
                          {m.sampleValues.slice(0, 2).join(", ")}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Select
                        value={mappingOverrides[m.csvColumnIndex] ?? m.mappedField}
                        onValueChange={(v) => handleMappingChange(m.csvColumnIndex, v as OptionsField)}
                      >
                        <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-xs h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map(f => (
                            <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Badge variant="outline" className={`text-[9px] shrink-0 ${
                        m.confidence === "high" ? "border-profit/30 text-profit" :
                        m.confidence === "medium" ? "border-yellow-500/30 text-yellow-400" :
                        "border-white/10 text-muted-foreground"
                      }`}>
                        {m.confidence}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right: Live preview */}
              <div className="w-1/2 overflow-auto border-l border-white/[0.06] pl-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Sample Data (first 5 rows)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {rawHeaders.map((h, i) => (
                          <th key={i} className="p-1.5 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-white/[0.04]">
                          {row.map((cell, j) => (
                            <td key={j} className="p-1.5 text-foreground font-mono whitespace-nowrap">{cell || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-white/[0.06] mt-4">
              <Button variant="outline" onClick={() => setStep("upload")} className="glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
                Back
              </Button>
              <Button onClick={proceedToPreview} className="flex-1">
                Parse & Preview Trades
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Preview ─── */}
        {step === "preview" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Stats bar */}
            <div className="flex items-center gap-3 pb-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-profit text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {validCount} ready
              </div>
              {warningCount > 0 && (
                <div className="flex items-center gap-1.5 text-yellow-400 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {warningCount} warnings
                </div>
              )}
              {invalidCount > 0 && (
                <div className="flex items-center gap-1.5 text-loss text-xs">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {invalidCount} invalid
                </div>
              )}
              {duplicateCount > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  {duplicateCount} duplicates
                </div>
              )}
              <div className="flex-1" />
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-7 pl-7 w-40 text-xs bg-white/[0.04] border-white/[0.08]"
                />
              </div>
            </div>

            {/* Trade table */}
            <div className="flex-1 overflow-auto min-h-0 border border-white/[0.06] rounded-lg">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-black/80 backdrop-blur z-10">
                  <tr className="border-b border-white/[0.06]">
                    <th className="p-2 text-left text-muted-foreground font-medium">Status</th>
                    <th className="p-2 text-left text-muted-foreground font-medium">Underlying</th>
                    <th className="p-2 text-left text-muted-foreground font-medium">Type</th>
                    <th className="p-2 text-left text-muted-foreground font-medium">Side</th>
                    <th className="p-2 text-right text-muted-foreground font-medium">Strike</th>
                    <th className="p-2 text-left text-muted-foreground font-medium">Expiry</th>
                    <th className="p-2 text-right text-muted-foreground font-medium">Contracts</th>
                    <th className="p-2 text-right text-muted-foreground font-medium">Entry $</th>
                    <th className="p-2 text-right text-muted-foreground font-medium">Exit $</th>
                    <th className="p-2 text-right text-muted-foreground font-medium">P&L</th>
                    <th className="p-2 text-left text-muted-foreground font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade) => (
                    <tr
                      key={trade.id}
                      className={`border-b border-white/[0.04] ${
                        !trade.isValid ? "opacity-50" :
                        trade.isDuplicate ? "opacity-40" : ""
                      }`}
                    >
                      <td className="p-2">
                        {trade.isDuplicate ? (
                          <Badge variant="outline" className="text-[9px] border-white/10">DUP</Badge>
                        ) : !trade.isValid ? (
                          <Badge variant="outline" className="text-[9px] border-loss/30 text-loss">ERR</Badge>
                        ) : trade.warnings.length > 0 ? (
                          <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400">WARN</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] border-profit/30 text-profit">OK</Badge>
                        )}
                      </td>
                      <td className="p-2 text-foreground font-mono">{trade.underlyingTicker}</td>
                      <td className="p-2 text-foreground">{trade.optionType === "call" ? "Call" : "Put"}</td>
                      <td className="p-2 text-foreground">{trade.positionSide === "long" ? "Long" : "Short"}</td>
                      <td className="p-2 text-right text-foreground font-mono">{trade.strikePrice}</td>
                      <td className="p-2 text-foreground">{trade.expirationDate}</td>
                      <td className="p-2 text-right text-foreground font-mono">{trade.contracts}</td>
                      <td className="p-2 text-right text-foreground font-mono">
                        {trade.entryPremium != null ? `$${trade.entryPremium.toFixed(2)}` : "—"}
                      </td>
                      <td className="p-2 text-right text-foreground font-mono">
                        {trade.exitPremium != null ? `$${trade.exitPremium.toFixed(2)}` : "—"}
                      </td>
                      <td className={`p-2 text-right font-mono ${
                        trade.realizedPnl != null ? (trade.realizedPnl >= 0 ? "text-profit" : "text-loss") : "text-muted-foreground"
                      }`}>
                        {trade.realizedPnl != null ? `${trade.realizedPnl >= 0 ? "+" : ""}$${trade.realizedPnl.toFixed(2)}` : "—"}
                      </td>
                      <td className="p-2">
                        {trade.errors.length > 0 && (
                          <span className="text-[9px] text-loss">{trade.errors[0]}</span>
                        )}
                        {trade.errors.length === 0 && trade.warnings.length > 0 && (
                          <span className="text-[9px] text-yellow-400">{trade.warnings[0]}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 pt-4 border-t border-white/[0.06] mt-4">
              <Button variant="outline" onClick={() => setStep("mapping")} className="glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
                Back
              </Button>
              <Button
                onClick={handleImport}
                className="flex-1"
                disabled={validCount === 0 || importing}
              >
                {importing ? "Importing..." : `Import ${validCount} Options Trades`}
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Report ─── */}
        {step === "report" && report && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 text-profit mx-auto mb-3" />
              <h3 className="text-lg font-medium text-foreground">Import Complete</h3>
              <p className="text-sm text-muted-foreground mt-1">{fileName}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-mono text-foreground">{report.totalRows}</p>
                <p className="text-[10px] text-muted-foreground">Total Rows</p>
              </div>
              <div className="rounded-xl bg-profit/10 border border-profit/20 p-4 text-center">
                <p className="text-2xl font-mono text-profit">{report.importedCount}</p>
                <p className="text-[10px] text-muted-foreground">Imported</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-mono text-muted-foreground">{report.duplicateCount}</p>
                <p className="text-[10px] text-muted-foreground">Duplicates</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-mono text-muted-foreground">{report.failedCount}</p>
                <p className="text-[10px] text-muted-foreground">Failed</p>
              </div>
            </div>

            <Button onClick={() => { reset(); onOpenChange(false); }} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
