import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REQUIRED_FIELDS = ["Symbol", "Side", "Qty", "Entry", "Exit"];
const ALL_FIELDS = ["Symbol", "Side", "Qty", "Entry", "Exit", "TP", "SL", "Open Time", "Close Time", "PnL", "Tags", "—skip—"];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  const rows = lines.slice(1).map(line => line.split(",").map(c => c.trim().replace(/"/g, "")));
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

export function CSVImportModal({ open, onOpenChange }: CSVImportModalProps) {
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<string[]>([]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
    const mappedFields = Object.values(columnMapping);
    const missingRequired = REQUIRED_FIELDS.filter(f => !mappedFields.includes(f));
    if (missingRequired.length > 0) {
      setErrors(missingRequired.map(f => `Missing required field: ${f}`));
      return;
    }

    // Validate rows
    const rowErrors: string[] = [];
    csvData?.rows.forEach((row, i) => {
      const symbolIdx = Object.entries(columnMapping).find(([, v]) => v === "Symbol")?.[0];
      if (symbolIdx !== undefined && !row[parseInt(symbolIdx)]) {
        rowErrors.push(`Row ${i + 1}: Missing symbol`);
      }
    });

    setErrors(rowErrors);
    setStep("preview");
  };

  const handleImport = () => {
    // TODO: Actually import trades to state/database
    onOpenChange(false);
    setStep("upload");
    setCsvData(null);
    setColumnMapping({});
    setErrors([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setStep("upload"); setCsvData(null); } }}>
      <DialogContent className="backdrop-blur-xl bg-black/60 border-white/[0.1] max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {step === "upload" && "Import CSV"}
            {step === "map" && "Map Columns"}
            {step === "preview" && "Preview Import"}
          </DialogTitle>
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
          </div>
        )}

        {step === "map" && csvData && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Found {csvData.headers.length} columns and {csvData.rows.length} rows. Map each CSV column to a trade field:
            </p>

            <div className="space-y-2 max-h-64 overflow-auto">
              {csvData.headers.map((header, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-foreground font-mono w-32 truncate shrink-0">{header}</span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <Select
                    value={columnMapping[idx] || ""}
                    onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [idx]: v }))}
                  >
                    <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-xs h-8">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_FIELDS.map(f => (
                        <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview first 3 rows */}
            <div className="overflow-x-auto">
              <p className="text-[10px] text-muted-foreground mb-1">Preview (first 3 rows):</p>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {csvData.headers.map((h, i) => (
                      <th key={i} className="p-1.5 text-left text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.04]">
                      {row.map((cell, j) => (
                        <td key={j} className="p-1.5 text-foreground font-mono">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {errors.length > 0 && (
              <div className="space-y-1">
                {errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-2 text-loss text-xs">
                    <AlertCircle className="h-3 w-3 shrink-0" /> {err}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("upload")} className="glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
                Back
              </Button>
              <Button onClick={validateAndPreview} className="flex-1">
                Validate & Preview
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && csvData && (
          <div className="space-y-4">
            {errors.length > 0 ? (
              <div className="space-y-1">
                {errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-2 text-loss text-xs">
                    <AlertCircle className="h-3 w-3 shrink-0" /> {err}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-profit text-sm">
                <CheckCircle2 className="h-4 w-4" />
                All {csvData.rows.length} rows validated successfully
              </div>
            )}

            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {Object.entries(columnMapping)
                      .filter(([, v]) => v !== "—skip—")
                      .map(([, field]) => (
                        <th key={field} className="p-1.5 text-left text-muted-foreground font-medium">{field}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.04]">
                      {Object.entries(columnMapping)
                        .filter(([, v]) => v !== "—skip—")
                        .map(([colIdx]) => (
                          <td key={colIdx} className="p-1.5 text-foreground font-mono">{row[parseInt(colIdx)]}</td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvData.rows.length > 10 && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  ...and {csvData.rows.length - 10} more rows
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("map")} className="glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
                Back
              </Button>
              <Button onClick={handleImport} className="flex-1" disabled={errors.length > 0}>
                Import {csvData.rows.length} Trades
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
