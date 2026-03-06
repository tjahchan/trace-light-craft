import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, X, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

interface Sound {
  id: string;
  icon: string;
  label: string;
  frequency: number; // Base frequency for brown/pink noise variation
}

const sounds: Sound[] = [
  { id: "rain", icon: "🌧️", label: "Rain", frequency: 200 },
  { id: "thunder", icon: "⛈️", label: "Thunder", frequency: 120 },
  { id: "ocean", icon: "🌊", label: "Ocean", frequency: 160 },
  { id: "waterfall", icon: "🌊", label: "Waterfall", frequency: 300 },
  { id: "forest", icon: "🐦", label: "Birds", frequency: 800 },
  { id: "fire", icon: "🔥", label: "Fire", frequency: 250 },
  { id: "wind", icon: "🌬️", label: "Wind", frequency: 100 },
  { id: "cafe", icon: "☕", label: "Café", frequency: 400 },
];

const timerPresets = [
  { label: "25m", minutes: 25 },
  { label: "45m", minutes: 45 },
  { label: "60m", minutes: 60 },
];

function createNoiseNode(ctx: AudioContext, freq: number): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  // Brown noise with frequency tinting
  let lastOut = 0;
  const factor = Math.min(freq / 500, 1);
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + (0.02 + factor * 0.03) * white) / (1.02 + factor * 0.03);
    data[i] = lastOut * (3 + factor * 2);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

export function AmbientFocusWidget() {
  const [expanded, setExpanded] = useState(false);
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [volume, setVolume] = useState([40]);
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const { toast } = useToast();

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAudio = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
  }, []);

  const playSound = useCallback((soundId: string) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    stopAudio();

    const sound = sounds.find((s) => s.id === soundId);
    if (!sound) return;

    const gain = ctx.createGain();
    gain.gain.value = volume[0] / 100;
    gain.connect(ctx.destination);
    gainRef.current = gain;

    const source = createNoiseNode(ctx, sound.frequency);
    source.connect(gain);
    source.start();
    sourceRef.current = source;
    setActiveSound(soundId);
  }, [volume, stopAudio]);

  const toggleSound = useCallback((soundId: string) => {
    if (activeSound === soundId) {
      stopAudio();
      setActiveSound(null);
    } else {
      playSound(soundId);
    }
  }, [activeSound, playSound, stopAudio]);

  // Volume change
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume[0] / 100;
    }
  }, [volume]);

  // Timer
  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            toast({ title: "🧘 Focus session complete", description: "Take a break." });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, timeLeft, toast]);

  const startTimer = (mins: number) => {
    setTimerMinutes(mins);
    setTimeLeft(mins * 60);
    setTimerRunning(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      audioCtxRef.current?.close();
    };
  }, [stopAudio]);

  return (
    <div className="fixed bottom-4 right-16 z-50">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="mb-2 backdrop-blur-xl bg-black/70 border border-white/[0.1] rounded-2xl p-4 w-72 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Ambient Focus</span>
              <button
                onClick={() => setExpanded(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sounds */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {sounds.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleSound(s.id)}
                  className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] shrink-0 transition-all ${
                    activeSound === s.id
                      ? "bg-primary/20 text-foreground ring-1 ring-primary/40"
                      : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                  }`}
                >
                  <span className="text-base">{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Volume */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Volume</span>
              <Slider
                value={volume}
                onValueChange={setVolume}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* Timer */}
            <div className="space-y-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Focus Timer</span>
              <div className="flex gap-1.5">
                {timerPresets.map((p) => (
                  <button
                    key={p.minutes}
                    onClick={() => startTimer(p.minutes)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      timerMinutes === p.minutes && timeLeft > 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {timeLeft > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono text-foreground">{formatTime(timeLeft)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => setTimerRunning(!timerRunning)}
                  >
                    {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => { setTimeLeft(0); setTimerRunning(false); setTimerMinutes(null); }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed pill */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-full backdrop-blur-xl border border-white/[0.1] text-sm transition-all ${
          activeSound
            ? "bg-primary/20 text-foreground"
            : "bg-black/40 text-muted-foreground hover:text-foreground"
        }`}
      >
        <Leaf className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Focus</span>
        {timeLeft > 0 && (
          <span className="text-[10px] font-mono text-primary ml-0.5">{formatTime(timeLeft)}</span>
        )}
      </button>
    </div>
  );
}
