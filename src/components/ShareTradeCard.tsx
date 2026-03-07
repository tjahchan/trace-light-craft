import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { X, Download, Copy, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ShareTradeCardProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  pnl: number;
  entryPrice: number;
  exitPrice: number;
  side: string;
  date: string;
  username?: string;
}

export function ShareTradeCard({
  open,
  onClose,
  symbol,
  pnl,
  entryPrice,
  exitPrice,
  side,
  date,
  username,
}: ShareTradeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const isProfit = pnl >= 0;
  const pctChange = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
  const adjustedPct = side === "Short" ? -pctChange : pctChange;

  const generateImage = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    setGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      return dataUrl;
    } catch {
      toast({ title: "Failed to generate image", variant: "destructive" });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = `momentra-${symbol}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    toast({ title: "Image downloaded" });
  };

  const handleCopy = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast({ title: "Image copied to clipboard" });
    } catch {
      toast({ title: "Copy not supported in this browser", variant: "destructive" });
    }
  };

  const handleShareTwitter = async () => {
    const text = `${isProfit ? "🟢" : "🔴"} ${symbol} ${isProfit ? "+" : ""}$${Math.abs(pnl).toFixed(2)} (${adjustedPct >= 0 ? "+" : ""}${adjustedPct.toFixed(2)}%)\n\nJournaled on @MomentraApp\nmomentra.app`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleShareDiscord = () => {
    const text = `${isProfit ? "🟢" : "🔴"} **${symbol}** ${isProfit ? "+" : ""}$${Math.abs(pnl).toFixed(2)} (${adjustedPct >= 0 ? "+" : ""}${adjustedPct.toFixed(2)}%) — Journaled on Momentra`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied for Discord", description: "Paste it in your Discord channel." });
  };

  // Generate SVG curve path
  const curvePath = isProfit
    ? "M 0 70 Q 40 65 80 50 Q 120 30 160 25 Q 200 15 240 8 Q 280 2 320 0"
    : "M 0 0 Q 40 5 80 20 Q 120 35 160 45 Q 200 55 240 62 Q 280 68 320 70";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4"
          >
            {/* The card to export */}
            <div
              ref={cardRef}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(145deg, #0a0a0f 0%, #111118 50%, #0a0a0f 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Header */}
              <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-0.5 rounded-full" style={{ background: "linear-gradient(to bottom, hsl(262,83%,58%), hsl(262,83%,38%))" }} />
                  <span className="text-white text-sm font-semibold tracking-[0.08em]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    Momentra
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {username ? `@${username}` : "Trader"}
                </span>
              </div>

              {/* PnL */}
              <div className="px-6 py-4 text-center">
                <p
                  className="text-4xl font-bold font-mono tracking-tight"
                  style={{ color: isProfit ? "#22c55e" : "#ef4444" }}
                >
                  {isProfit ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
                </p>
                <p
                  className="text-sm font-mono mt-1"
                  style={{ color: isProfit ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)" }}
                >
                  {adjustedPct >= 0 ? "+" : ""}{adjustedPct.toFixed(2)}%
                </p>
              </div>

              {/* Chart curve */}
              <div className="px-6">
                <svg viewBox="0 0 320 70" className="w-full h-16" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isProfit ? "#22c55e" : "#ef4444"} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={isProfit ? "#22c55e" : "#ef4444"} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${curvePath} L 320 70 L 0 70 Z`} fill="url(#curveGrad)" />
                  <path d={curvePath} fill="none" stroke={isProfit ? "#22c55e" : "#ef4444"} strokeWidth="2" />
                </svg>
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 pt-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-semibold">{symbol}</p>
                  <p className="text-gray-500 text-[11px]">{date}</p>
                </div>
                <p className="text-gray-600 text-[10px] italic">Journaled on Momentra</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={handleCopy} disabled={generating} className="gap-1.5 bg-white/[0.04] border-white/[0.08] text-foreground hover:bg-white/[0.08]">
                <Copy className="h-3.5 w-3.5" /> Copy Image
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownload} disabled={generating} className="gap-1.5 bg-white/[0.04] border-white/[0.08] text-foreground hover:bg-white/[0.08]">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
              <Button size="sm" variant="outline" onClick={handleShareTwitter} className="gap-1.5 bg-white/[0.04] border-white/[0.08] text-foreground hover:bg-white/[0.08]">
                <Share2 className="h-3.5 w-3.5" /> Twitter/X
              </Button>
              <Button size="sm" variant="outline" onClick={handleShareDiscord} className="gap-1.5 bg-white/[0.04] border-white/[0.08] text-foreground hover:bg-white/[0.08]">
                <Share2 className="h-3.5 w-3.5" /> Discord
              </Button>
            </div>

            {/* Close */}
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground gap-1.5">
                <X className="h-3.5 w-3.5" /> Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
