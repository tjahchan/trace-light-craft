import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

const ease = [0.22, 1, 0.36, 1];

function MockCalendar() {
  // Simplified calendar heatmap
  const days = Array.from({ length: 28 }, (_, i) => {
    const rand = Math.random();
    return rand > 0.6 ? "profit" : rand > 0.35 ? "loss" : "empty";
  });

  return (
    <div className="glass-card p-5 space-y-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">February Activity</p>
      <div className="grid grid-cols-7 gap-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-[8px] text-muted-foreground/50 text-center">{d}</span>
        ))}
        {days.map((d, i) => (
          <div
            key={i}
            className={`aspect-square rounded-sm ${
              d === "profit" ? "bg-profit/30" : d === "loss" ? "bg-loss/20" : "bg-white/[0.03]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function MockLeaderboard() {
  const users = [
    { rank: 1, name: "TradeMaster", streak: 42, badge: "🏆" },
    { rank: 2, name: "EdgeTrader", streak: 38, badge: "🥈" },
    { rank: 3, name: "AlphaFX", streak: 31, badge: "🥉" },
    { rank: 4, name: "You", streak: 7, badge: "", highlight: true },
  ];

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-yellow-400/60" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Leaderboard</p>
      </div>
      {users.map((u) => (
        <div
          key={u.rank}
          className={`flex items-center justify-between p-2.5 rounded-lg border ${
            u.highlight ? "bg-primary/5 border-primary/15" : "bg-white/[0.02] border-white/[0.05]"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground w-5">{u.badge || `#${u.rank}`}</span>
            <span className={`text-xs font-medium ${u.highlight ? "text-primary" : "text-foreground"}`}>{u.name}</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{u.streak} day streak</span>
        </div>
      ))}
    </div>
  );
}

export function LandingAnalytics() {
  return (
    <section id="analytics" className="relative py-32 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease }}
          className="text-center mb-16"
        >
          <span className="text-[11px] font-medium text-primary uppercase tracking-[0.2em] mb-4 block">Insights</span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">
            See Your Progress Clearly
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-base">
            Track performance, review patterns, and compete with fellow traders.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease }}
          >
            <MockCalendar />
            <p className="text-center mt-3 text-xs text-muted-foreground">
              Visual calendar review of your trading activity
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.15, ease }}
          >
            <MockLeaderboard />
            <p className="text-center mt-3 text-xs text-muted-foreground">
              Trade with accountability and motivation
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
