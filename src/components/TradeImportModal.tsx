import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface TradeImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function detectAssetType(symbol: string): "forex" | "crypto" | "stock" {
  const s = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  const forexPairs = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD", "USDCHF", "GBPJPY", "EURJPY", "EURGBP", "XAUUSD", "XAGUSD"];
  if (forexPairs.some(p => s.includes(p))) return "forex";
  const crypto = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "BNB", "AVAX"];
  if (crypto.some(c => s.includes(c))) return "crypto";
  return "stock";
}

function calculatePnL(
  symbol: string,
  side: string,
  qty: number,
  entry: number,
  exit: number
): number | null {
  if (!side || !qty || !entry || !exit) return null;
  const type = detectAssetType(symbol);
  let pnl: number;

  if (type === "forex") {
    // Simplified: (exit - entry) * qty * 100000 for standard lots
    // For JPY pairs, pip value differs
    const isJpy = symbol.toUpperCase().includes("JPY");
    const pipMultiplier = isJpy ? 100 : 10000;
    const pipValue = isJpy ? 1000 : 10; // per standard lot
    pnl = (exit - entry) * pipMultiplier * qty * pipValue / pipMultiplier;
    // Simplified: just use (exit - entry) * qty * 100000 for most pairs
    pnl = (exit - entry) * qty * 100000;
    if (symbol.toUpperCase().includes("JPY")) {
      pnl = (exit - entry) * qty * 1000;
    }
    if (symbol.toUpperCase().includes("XAU")) {
      pnl = (exit - entry) * qty * 100;
    }
  } else {
    pnl = (exit - entry) * qty;
  }

  if (side === "short") pnl = -pnl;
  return pnl;
}

export function TradeImportModal({ open, onOpenChange }: TradeImportModalProps) {
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("");
  const [qty, setQty] = useState("");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");

  const pnl = useMemo(() => {
    return calculatePnL(
      symbol,
      side,
      parseFloat(qty),
      parseFloat(entry),
      parseFloat(exit)
    );
  }, [symbol, side, qty, entry, exit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-black/60 border-white/[0.1] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Import Trade</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Symbol</Label>
              <Input
                placeholder="EUR/USD"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="mt-1 bg-white/[0.04] border-white/[0.08]"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Side</Label>
              <Select value={side} onValueChange={setSide}>
                <SelectTrigger className="mt-1 bg-white/[0.04] border-white/[0.08]">
                  <SelectValue placeholder="Long / Short" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Qty</Label>
              <Input
                type="number"
                placeholder="1.0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Entry</Label>
              <Input
                type="number"
                placeholder="1.0842"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Exit</Label>
              <Input
                type="number"
                placeholder="1.0891"
                value={exit}
                onChange={(e) => setExit(e.target.value)}
                className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono"
              />
            </div>
          </div>

          {/* Live PnL Preview */}
          {pnl !== null && (
            <div className={`rounded-xl p-4 text-center font-mono ${
              pnl >= 0
                ? "bg-profit/10 border border-profit/20"
                : "bg-loss/10 border border-loss/20"
            }`}>
              <p className="text-xs text-muted-foreground mb-1">Estimated PnL</p>
              <p className={`text-2xl font-medium ${pnl >= 0 ? "text-profit" : "text-loss"}`}>
                {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {detectAssetType(symbol).toUpperCase()} • {side === "long" ? "Long" : "Short"}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Take Profit</Label>
              <Input type="number" placeholder="TP" className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Stop Loss</Label>
              <Input type="number" placeholder="SL" className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Date & Time</Label>
            <Input type="datetime-local" className="mt-1 bg-white/[0.04] border-white/[0.08]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <Input placeholder="Scalp, Breakout" className="mt-1 bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Alias</Label>
              <Input placeholder="Morning Dip" className="mt-1 bg-white/[0.04] border-white/[0.08]" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea placeholder="Trade notes..." className="mt-1 bg-white/[0.04] border-white/[0.08] resize-none" rows={2} />
          </div>
          <Button className="w-full mt-2">Save Trade</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
