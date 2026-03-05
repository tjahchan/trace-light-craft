import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, RefreshCw, ExternalLink, ThumbsUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const leaderboard = [
  { rank: 1, trader: "tr***@gmail.com", streak: 28 },
  { rank: 2, trader: "al***@yahoo.com", streak: 25 },
  { rank: 3, trader: "ma***@outlook.com", streak: 22 },
  { rank: 4, trader: "jo***@gmail.com", streak: 19 },
  { rank: 5, trader: "sa***@proton.me", streak: 17 },
  { rank: 6, trader: "li***@gmail.com", streak: 15 },
  { rank: 7, trader: "ch***@icloud.com", streak: 14 },
  { rank: 8, trader: "em***@gmail.com", streak: 12 },
];

const forumPosts = [
  { user: "TraderAlex", time: "2h ago", message: "Anyone else watching the EUR/USD breakout? Clean setup forming on the 4H chart.", likes: 12 },
  { user: "SwingKing", time: "5h ago", message: "Just hit my 20-day streak! Journaling every trade has been a game changer for my discipline.", likes: 24 },
  { user: "ForexNova", time: "1d ago", message: "Risk management tip: Never risk more than 1% on a single trade. It sounds boring but it keeps you in the game.", likes: 31 },
];

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) { setTimeLeft("Challenge ended!"); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft(`${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);
  return timeLeft;
}

export default function Community() {
  const countdown = useCountdown(new Date("2026-04-01T00:00:00Z"));

  const crownColor = (rank: number) => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-gray-300";
    if (rank === 3) return "text-amber-600";
    return "";
  };

  return (
    <div className="flex gap-6 flex-col xl:flex-row">
      {/* Left — Leaderboard */}
      <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Leaderboard</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Compete with your highest daily streak of the month</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-muted-foreground text-xs uppercase tracking-wider">
                <th className="p-3 text-left font-medium w-16">Rank</th>
                <th className="p-3 text-left font-medium">Trader</th>
                <th className="p-3 text-right font-medium">Streak</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((item) => (
                <tr key={item.rank} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {item.rank <= 3 && <Crown className={`h-3.5 w-3.5 ${crownColor(item.rank)}`} />}
                      <span className="font-mono text-foreground">{item.rank}</span>
                    </div>
                  </td>
                  <td className="p-3 text-foreground font-mono text-xs">{item.trader}</td>
                  <td className="p-3 text-right font-mono text-foreground">{item.streak} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Forum */}
        <div className="mt-6 space-y-3">
          <a
            href="https://t.me/tradelog"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-card p-3 flex items-center justify-between text-sm text-primary hover:bg-white/[0.06] transition-colors block"
          >
            <span>Join our Telegram community →</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          {forumPosts.map((post, i) => (
            <div key={i} className="glass-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{post.user}</span>
                <span className="text-[10px] text-muted-foreground">{post.time}</span>
              </div>
              <p className="text-sm text-foreground/80">{post.message}</p>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ThumbsUp className="h-3 w-3" /> {post.likes}
                </button>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <MessageSquare className="h-3 w-3" /> Reply
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Right — Challenge Info */}
      <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="w-full xl:w-80 shrink-0 space-y-4">
        <div className="glass-card p-5 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Challenge ends in</p>
          <p className="text-2xl font-mono font-medium text-foreground">{countdown}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Resets April 1, 2026 at 00:00</p>
        </div>

        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Your Position</p>
          <p className="text-lg font-mono text-foreground">#42 <span className="text-xs text-muted-foreground">of 1,247</span></p>
          <p className="text-sm font-mono text-foreground mt-1">Score: 5 days</p>
          <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] bg-profit/20 text-profit">Logged today ✓</span>
        </div>

        <div className="glass-card p-5">
          <p className="text-sm font-semibold text-foreground mb-2">Monthly Streak Challenge</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Top 3 traders each month receive a free PRO subscription. Log daily and climb the board.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
