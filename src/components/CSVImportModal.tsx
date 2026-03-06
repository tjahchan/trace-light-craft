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
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";
import { toast } from "sonner";

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onImportComplete?: () => void;
}

const REQUIRED_FIELDS = ["Symbol", "Side", "Qty", "Entry", "Exit"];
const ALL_FIELDS = ["Symbol", "Side", "Qty", "Entry", "Exit", "TP", "SL", "Open Time", "Close Time", "PnL", "Tags", "Commissions", "—skip—"];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  const rows = lines.slice(1).filter(l => l.trim()).map(line => line.split(",").map(c => c.trim().replace(/"/g, "")));
  return { headers, rows };
}

function autoMapHeaders(csvHeaders: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  const aliases: Record<string, string[]> = {
    Symbol: ["symbol", "pair", "instrument", "ticker", "asset"],
    Side: ["side", "type", "direction", "action", "order type"],
    Qty: ["qty", "quantity", "volume", "lots", "size", "amount"],
    Entry: ["entry", "open", "open price", "entry price", "buy price"],
    Exit: ["exit", "close", "close price", "exit price", "sell price"],
    TP: ["tp", "take profit", "target"],
    SL: ["sl", "stop loss", "stop"],
    "Open Time": ["open time", "open date", "opened", "entry time", "entry date"],
    "Close Time": ["close time", "close date", "closed", "exit time", "exit date"],
    PnL: ["pnl", "profit", "p&l", "realized pnl", "net profit", "result"],
    Tags: ["tags", "label", "category", "setup"],
    Commissions: ["commissions", "commission", "fees", "fee", "broker fee"],
  };

  csvHeaders.forEach((h, i) => {
    const lower = h.toLowerCase().trim();
    for (const [field, alts] of Object.entries(aliases)) {
      if (alts.includes(lower) || lower === field.toLowerCase()) {
        mapping[i] = field;
        break;
      }
    }
  });
  return mapping;
}

function getVal(row: string[], mapping: Record<number, string>, field: string): string | undefined {
  const entry = Object.entries(mapping).find(([, v]) => v === field);
  if (!entry) return undefined;
  return row[parseInt(entry[0])] || undefined;
}

export function CSVImportModal({ open, onOpenChange, accountId, onImportComplete }: CSVImportModalProps) {
  const { user } = useAuth();
  const { checkAndIncrementUsage, triggerUpgrade, csvImportsUsed, csvLimit, isPro } = usePlan();
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      console.log("[CSV Import] Parsed CSV:", parsed.headers.length, "columns,", parsed.rows.length, "rows");
      setCsvData(parsed);
      setColumnMapping(autoMapHeaders(parsed.headers));
      setStep("map");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setCsvData(parsed);
      setColumnMapping(autoMapHeaders(parsed.headers));
      setStep("map");
    };
    reader.readAsText(file);
  }, []);

  const validateAndPreview = () => {
    console.log("[CSV Import] Validating mappings:", columnMapping);
    const mappedFields = Object.values(columnMapping);
    const missingRequired = REQUIRED_FIELDS.filter(f => !mappedFields.includes(f));
    if (missingRequired.length > 0) {
      setErrors(missingRequired.map(f => `Missing required field: ${f}`));
      return;
    }

    const rowErrors: string[] = [];
    csvData?.rows.forEach((row, i) => {
      const symbol = getVal(row, columnMapping, "Symbol");
      if (!symbol) rowErrors.push(`Row ${i + 1}: Missing symbol`);
    });

    console.log("[CSV Import] Validation complete. Errors:", rowErrors.length);
    setErrors(rowErrors);
    setStep("preview");
  };

  const handleImport = async () => {
    if (!user || !csvData) return;

    // Check plan limits
    const usageResult = await checkAndIncrementUsage("csv");
    if (!usageResult.allowed) {
      triggerUpgrade("You've reached your monthly CSV import limit. Upgrade to Pro for unlimited imports.");
      return;
    }

    // UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user.id)) {
      toast.error("Import error: could not resolve user ID. Please re-login and try again.");
      return;
    }
    if (!uuidRegex.test(accountId)) {
      toast.error("Import error: could not resolve account ID. Please re-select your account and try again.");
      console.error("[CSV Import] Invalid account_id:", accountId);
      return;
    }

    setImporting(true);
    console.log("[CSV Import] Starting import of", csvData.rows.length, "trades");
    console.log("[CSV Import] user_id:", user.id, "account_id:", accountId);

    try {
      const trades = csvData.rows.map((row) => {
        const side = getVal(row, columnMapping, "Side") || "Long";
        const normalizedSide = side.toLowerCase().includes("buy") || side.toLowerCase().includes("long") ? "Long" : "Short";
        return {
          user_id: user.id,
          account_id: accountId,
          symbol: getVal(row, columnMapping, "Symbol") || "",
          side: normalizedSide,
          quantity: parseFloat(getVal(row, columnMapping, "Qty") || "0") || 0,
          entry_price: parseFloat(getVal(row, columnMapping, "Entry") || "0") || 0,
          exit_price: parseFloat(getVal(row, columnMapping, "Exit") || "0") || null,
          tp: parseFloat(getVal(row, columnMapping, "TP") || "") || null,
          sl: parseFloat(getVal(row, columnMapping, "SL") || "") || null,
          open_time: getVal(row, columnMapping, "Open Time") || null,
          close_time: getVal(row, columnMapping, "Close Time") || null,
          pnl: parseFloat(getVal(row, columnMapping, "PnL") || "0") || 0,
          commissions: parseFloat(getVal(row, columnMapping, "Commissions") || "0") || 0,
          tags: getVal(row, columnMapping, "Tags") ? [getVal(row, columnMapping, "Tags")!] : [],
          status: "closed" as const,
        };
      });

      console.log("[CSV Import] Inserting trades:", trades.length);
      const { data: insertedTrades, error } = await supabase.from("trades" as any).insert(trades as any).select();

      if (error) {
        console.error("[CSV Import] Insert error:", error);
        toast.error(`Import failed: ${error.message}`);
        return;
      }

      console.log("[CSV Import] Insert successful!");
      toast.success(`✓ ${trades.length} trades imported successfully`);
      onOpenChange(false);
      setStep("upload");
      setCsvData(null);
      setColumnMapping({});
      setErrors([]);
      onImportComplete?.();
    } catch (err: any) {
      console.error("[CSV Import] Unexpected error:", err);
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Mapped field names for preview table headers
  const mappedEntries = useMemo(() =>
    Object.entries(columnMapping).filter(([, v]) => v !== "—skip—" && v),
    [columnMapping]
  );

  const close = () => {
    onOpenChange(false);
    setStep("upload");
    setCsvData(null);
    setColumnMapping({});
    setErrors([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(v); }}>
      <DialogContent className={
        step === "upload"
          ? "backdrop-blur-xl bg-black/60 border-white/[0.1] max-w-2xl"
          : "backdrop-blur-xl bg-black/60 border-white/[0.1] w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] flex flex-col"
      }>
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {step === "upload" && "Import CSV"}
            {step === "map" && "Map Columns"}
            {step === "preview" && "Preview Import"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {step === "upload" && "Upload a CSV file to import trades"}
            {step === "map" && `Found ${csvData?.headers.length || 0} columns and ${csvData?.rows.length || 0} rows`}
            {step === "preview" && `Review ${csvData?.rows.length || 0} trades before importing`}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-white/[0.1] rounded-2xl p-12 text-center hover:border-white/[0.2] transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Drag & drop your CSV file, or click to browse
            </p>
            <p className="text-[10px] text-muted-foreground mb-4">
              Supports MetaTrader 4/5, TradingView, Binance, and generic CSV formats
            </p>
            <label>
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
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

        {step === "map" && csvData && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex gap-6 min-h-0">
              {/* Left: Column mapping */}
              <div className="w-1/2 overflow-y-auto space-y-2 pr-2">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Column Mapping</p>
                {csvData.headers.map((header, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-3 px-3 rounded-lg bg-white/[0.02]">
                    <span className="text-sm text-foreground font-mono w-40 truncate shrink-0">{header}</span>
                    <span className="text-muted-foreground text-sm">→</span>
                    <Select
                      value={columnMapping[idx] || ""}
                      onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [idx]: v }))}
                    >
                      <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-sm h-10">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_FIELDS.map(f => (
                          <SelectItem key={f} value={f} className="text-sm">{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Right: Live preview */}
              <div className="w-1/2 overflow-auto border-l border-white/[0.06] pl-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Live Preview (first 5 rows)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {mappedEntries.map(([, field]) => (
                          <th key={field} className="p-2 text-left text-muted-foreground font-medium whitespace-nowrap">{field}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-white/[0.04]">
                          {mappedEntries.map(([colIdx]) => (
                            <td key={colIdx} className="p-2 text-foreground font-mono whitespace-nowrap">{row[parseInt(colIdx)] || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="space-y-1 pt-3">
                {errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-2 text-loss text-xs">
                    <AlertCircle className="h-3 w-3 shrink-0" /> {err}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t border-white/[0.06] mt-4">
              <Button variant="outline" onClick={() => setStep("upload")} className="glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
                Back
              </Button>
              <Button onClick={validateAndPreview} className="flex-1">
                Continue to Preview
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && csvData && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Validation summary */}
            {errors.length > 0 ? (
              <div className="space-y-1 pb-3">
                <div className="flex items-center gap-2 text-loss text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  ⚠ {errors.length} rows have errors
                </div>
                {errors.slice(0, 5).map((err, i) => (
                  <div key={i} className="flex items-center gap-2 text-loss text-xs pl-6">
                    {err}
                  </div>
                ))}
                {errors.length > 5 && <p className="text-xs text-muted-foreground pl-6">...and {errors.length - 5} more</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-profit text-sm pb-3">
                <CheckCircle2 className="h-4 w-4" />
                ✓ All {csvData.rows.length} rows validated successfully
              </div>
            )}

            {/* Scrollable table */}
            <div className="flex-1 overflow-auto min-h-0 border border-white/[0.06] rounded-lg">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-black/80 backdrop-blur z-10">
                  <tr className="border-b border-white/[0.06]">
                    {mappedEntries.map(([, field]) => (
                      <th key={field} className="p-2.5 text-left text-muted-foreground font-medium whitespace-nowrap">{field}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.rows.map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.04]">
                      {mappedEntries.map(([colIdx]) => (
                        <td key={colIdx} className="p-2.5 text-foreground font-mono whitespace-nowrap">{row[parseInt(colIdx)] || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 pt-4 border-t border-white/[0.06] mt-4">
              <Button variant="outline" onClick={() => setStep("map")} className="glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
                Back
              </Button>
              <Button onClick={handleImport} className="flex-1" disabled={errors.length > 0 || importing}>
                {importing ? "Importing..." : `Import ${csvData.rows.length} Trades`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
