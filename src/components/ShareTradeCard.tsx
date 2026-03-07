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
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
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

  const handleShareTwitter = () => {
    const text = `${isProfit ? "🟢" : "🔴"} ${symbol} ${isProfit ? "+" : ""}$${Math.abs(pnl).toFixed(2)} (${adjustedPct >= 0 ? "+" : ""}${adjustedPct.toFixed(2)}%)\n\nTracked on @MomentraApp\nmomentra.app`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleShareDiscord = () => {
    const text = `${isProfit ? "🟢" : "🔴"} **${symbol}** ${isProfit ? "+" : ""}$${Math.abs(pnl).toFixed(2)} (${adjustedPct >= 0 ? "+" : ""}${adjustedPct.toFixed(2)}%) — Tracked on Momentra`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied for Discord", description: "Paste it in your Discord channel." });
  };

  // Dramatic curve paths
  const curvePath = isProfit
    ? "M 0 140 C 60 135 100 120 160 95 C 220 65 280 30 360 15 C 440 5 520 2 640 0"
    : "M 0 0 C 60 5 100 20 160 45 C 220 75 280 110 360 125 C 440 135 520 138 640 140";

  const accentColor = isProfit ? "#22c55e" : "#ef4444";
  const glowColor = isProfit ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)";
  const softGlow = isProfit ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl space-y-5"
          >
            {/* ——— The exportable landscape card ——— */}
            <div
              ref={cardRef}
              className="rounded-2xl overflow-hidden relative"
              style={{
                aspectRatio: "16 / 9",
                background: "linear-gradient(160deg, #07070c 0%, #0d0d15 35%, #0a0a12 70%, #060609 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Ambient glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 70% 60% at 75% 50%, ${glowColor}, transparent 70%)`,
                }}
              />
              {/* Subtle grid texture */}
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.03]"
                style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                  backgroundSize: "40px 40px",
                }}
              />
              {/* Vignette */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)",
                }}
              />

              {/* Content layout */}
              <div className="relative h-full flex flex-col justify-between p-6 sm:p-8">
                {/* Top row: brand + username */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-5 w-1 rounded-full"
                      style={{ background: `linear-gradient(to bottom, ${accentColor}, transparent)` }}
                    />
                    <span
                      className="text-white/90 text-sm font-semibold tracking-[0.12em] uppercase"
                      style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                      Momentra
                    </span>
                  </div>
                  <span className="text-white/40 text-xs font-medium tracking-wide">
                    {username ? `@${username}` : ""}
                  </span>
                </div>

                {/* Center: PnL + info */}
                <div className="flex items-end justify-between flex-1 py-2">
                  {/* Left: PnL */}
                  <div className="flex flex-col justify-center gap-1 z-10">
                    <p
                      className="text-5xl sm:text-6xl font-bold font-mono tracking-tight leading-none"
                      style={{
                        color: accentColor,
                        textShadow: `0 0 40px ${glowColor}, 0 0 80px ${softGlow}`,
                      }}
                    >
                      {isProfit ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
                    </p>
                    <p
                      className="text-lg sm:text-xl font-mono font-medium tracking-tight"
                      style={{ color: accentColor, opacity: 0.7 }}
                    >
                      {adjustedPct >= 0 ? "+" : ""}{adjustedPct.toFixed(2)}%
                    </p>
                  </div>

                  {/* Right: Chart graphic */}
                  <div className="absolute right-0 bottom-0 w-[60%] h-[65%] pointer-events-none">
                    <svg viewBox="0 0 640 140" className="w-full h-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="shareGradFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={accentColor} stopOpacity="0.25" />
                          <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
                        </linearGradient>
                        <filter id="shareGlow">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <path d={`${curvePath} L 640 140 L 0 140 Z`} fill="url(#shareGradFill)" />
                      <path
                        d={curvePath}
                        fill="none"
                        stroke={accentColor}
                        strokeWidth="2.5"
                        filter="url(#shareGlow)"
                        strokeLinecap="round"
                      />
                      {/* Endpoint dot */}
                      <circle
                        cx={isProfit ? "640" : "640"}
                        cy={isProfit ? "0" : "140"}
                        r="4"
                        fill={accentColor}
                        filter="url(#shareGlow)"
                      />
                    </svg>
                  </div>
                </div>

                {/* Bottom row: symbol + date */}
                <div className="flex items-end justify-between z-10">
                  <div className="flex items-center gap-4">
                    <span className="text-white text-sm font-semibold tracking-wide">{symbol}</span>
                    <span className="text-white/30 text-xs">{date}</span>
                  </div>
                  <span
                    className="text-white/20 text-[10px] tracking-wider uppercase"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    momentra.app
                  </span>
                </div>
              </div>
            </div>

            {/* ——— Share actions ——— */}
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { label: "Copy Image", icon: Copy, handler: handleCopy },
                { label: "Download", icon: Download, handler: handleDownload },
                { label: "Twitter / X", icon: Share2, handler: handleShareTwitter },
                { label: "Discord", icon: Share2, handler: handleShareDiscord },
              ].map(({ label, icon: Icon, handler }) => (
                <Button
                  key={label}
                  size="sm"
                  variant="outline"
                  onClick={handler}
                  disabled={generating && (label === "Copy Image" || label === "Download")}
                  className="gap-1.5 bg-white/[0.04] border-white/[0.08] text-foreground hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-200"
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Button>
              ))}
            </div>

            {/* Close */}
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground gap-1.5 hover:text-foreground">
                <X className="h-3.5 w-3.5" /> Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
