import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, RotateCcw, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const timerPresets = [
  { label: "25m", minutes: 25 },
  { label: "45m", minutes: 45 },
  { label: "60m", minutes: 60 },
];

const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MAX_MINUTES = 120;

interface FocusWidgetProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export function FocusWidget({ externalOpen, onExternalClose }: FocusWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Open from external trigger
  useEffect(() => {
    if (externalOpen) setExpanded(true);
  }, [externalOpen]);

  // Sync close
  useEffect(() => {
    if (!expanded && externalOpen) onExternalClose?.();
  }, [expanded, externalOpen, onExternalClose]);

  // Timer countdown
  useEffect(() => {
    if (running && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setRunning(false);
            setSessionComplete(true);
            toast({ title: "✓ Focus session complete", description: "Well done." });
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Focus session complete. Well done.");
            }
            setTimeout(() => setSessionComplete(false), 3000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, timeLeft, toast]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const progress = totalSeconds > 0 ? timeLeft / totalSeconds : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  const setPreset = (mins: number) => {
    setTotalSeconds(mins * 60);
    setTimeLeft(mins * 60);
    setRunning(false);
  };

  const handlePlay = () => {
    if (timeLeft <= 0) return;
    setRunning(true);
    setShowPulse(true);
    setTimeout(() => setShowPulse(false), 800);
    setExpanded(false);
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const handleReset = () => {
    setRunning(false);
    setTimeLeft(0);
    setTotalSeconds(0);
    setSessionComplete(false);
  };

  // Drag on ring to set time
  const getAngleFromEvent = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    let angle = Math.atan2(clientY - cy, clientX - cx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    return angle;
  }, []);

  const setTimeFromAngle = useCallback((angle: number) => {
    const fraction = angle / (2 * Math.PI);
    const mins = Math.round(fraction * MAX_MINUTES);
    const clamped = Math.max(1, Math.min(MAX_MINUTES, mins));
    setTotalSeconds(clamped * 60);
    setTimeLeft(clamped * 60);
    setRunning(false);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const angle = getAngleFromEvent(e);
      setTimeFromAngle(angle);
    };
    const handleUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [getAngleFromEvent, setTimeFromAngle]);

  const handleRingMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const angle = getAngleFromEvent(e as any);
    setTimeFromAngle(angle);
  };

  const handleAngle = totalSeconds > 0 ? (timeLeft / totalSeconds) * 2 * Math.PI : 0;
  const handleX = 90 + RING_RADIUS * Math.sin(handleAngle);
  const handleY = 90 - RING_RADIUS * Math.cos(handleAngle);

  return (
    <>
      {/* Full-screen pulse */}
      <AnimatePresence>
        {showPulse && (
          <motion.div
            initial={{ opacity: 0.6, boxShadow: "0 0 0 0 rgba(99,102,241,0.5)" }}
            animate={{ opacity: 0, boxShadow: "0 0 0 120px rgba(99,102,241,0)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="fixed inset-0 z-[60] pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Persistent bottom timer pill when running */}
      <AnimatePresence>
        {(running || sessionComplete) && !expanded && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => setExpanded(true)}
            className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl border border-white/[0.1] text-sm transition-all ${
              sessionComplete
                ? "bg-green-500/20 text-green-400 animate-pulse"
                : "bg-black/50 text-foreground"
            }`}
          >
            {sessionComplete ? (
              <>✓ Session complete</>
            ) : (
              <>
                <Target className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Focus</span>
                <span className="text-xs font-mono text-primary">{formatTime(timeLeft)}</span>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Widget panel */}
      <div className="fixed bottom-16 left-4 z-[300]" ref={containerRef}>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="mb-2 backdrop-blur-xl bg-black/70 border border-white/[0.1] rounded-2xl p-5 w-[220px] flex flex-col items-center gap-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-medium text-foreground">Focus</span>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Ring Timer */}
              <svg
                width="180"
                height="180"
                className="cursor-pointer select-none"
                onMouseDown={handleRingMouseDown}
                onTouchStart={handleRingMouseDown}
              >
                <circle cx="90" cy="90" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <circle
                  ref={ringRef}
                  cx="90" cy="90" r={RING_RADIUS} fill="none"
                  stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={dashOffset}
                  transform="rotate(-90 90 90)"
                  className="transition-[stroke-dashoffset] duration-200"
                />
                {totalSeconds > 0 && (
                  <circle cx={handleX} cy={handleY} r="8" fill="hsl(var(--primary))" stroke="rgba(0,0,0,0.5)" strokeWidth="2" className="cursor-grab" />
                )}
                <text x="90" y="85" textAnchor="middle" className="fill-foreground" style={{ fontSize: "24px", fontFamily: "ui-monospace, monospace" }}>
                  {formatTime(timeLeft)}
                </text>
                <foreignObject x="65" y="95" width="50" height="30">
                  <div className="flex items-center justify-center gap-2">
                    {running ? (
                      <button onClick={(e) => { e.stopPropagation(); setRunning(false); }} className="text-muted-foreground hover:text-foreground">
                        <Pause className="h-5 w-5" />
                      </button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); handlePlay(); }} className="text-muted-foreground hover:text-foreground">
                        <Play className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </foreignObject>
              </svg>

              {/* Presets */}
              <div className="flex gap-1.5">
                {timerPresets.map((p) => (
                  <button
                    key={p.minutes}
                    onClick={() => setPreset(p.minutes)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      Math.round(totalSeconds / 60) === p.minutes
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button onClick={handleReset} className="text-muted-foreground hover:text-foreground transition-colors">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
