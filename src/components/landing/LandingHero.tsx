import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrokerLogoStrip } from "@/components/landing/BrokerLogoStrip";
import type { Easing } from "framer-motion";

const ease: Easing = [0.22, 1, 0.36, 1];

function MockDashboard() {
  return (
    <div className="relative w-full max-w-5xl mx-auto mt-16 px-4">
      <div className="absolute inset-0 -top-20 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative flex items-start justify-center gap-4 md:gap-6">
        {/* Left — Journal */}
        <motion.div
          initial={{ opacity: 0, x: -60, rotateY: 8 }}
          animate={{ opacity: 1, x: 0, rotateY: 4 }}
          transition={{ duration: 1.2, delay: 0.4, ease }}
          className="hidden md:block w-56 lg:w-64 shrink-0 -mt-4"
        >
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Trade Journal</span>
            </div>
            <div className="space-y-2">
              <div className="h-2.5 w-3/4 rounded bg-foreground/10" />
              <div className="h-2 w-full rounded bg-foreground/5" />
              <div className="h-2 w-5/6 rounded bg-foreground/5" />
            </div>
            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Emotion</p>
              <div className="flex gap-1.5">
                {["😤", "😐", "🙂", "😊", "🔥"].map((e, i) => (
                  <span key={i} className={`text-sm p-1 rounded ${i === 3 ? "bg-primary/20 ring-1 ring-primary/40" : "opacity-40"}`}>{e}</span>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-white/[0.06]">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Discipline</p>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-primary/60 to-primary" />
              </div>
              <p className="text-[10px] text-primary/70 mt-1 text-right font-mono">8.5/10</p>
            </div>
          </div>
        </motion.div>

        {/* Center — Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease }}
          className="w-full max-w-md lg:max-w-lg z-10"
        >
          <div className="glass-card p-5 space-y-4 ring-1 ring-primary/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Performance</p>
                <p className="text-xl sm:text-2xl font-mono font-bold text-foreground mt-0.5">Trading Dashboard</p>
              </div>
              <span className="text-xs font-mono text-profit bg-profit/10 px-2 py-1 rounded-md">Live</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Win Rate", value: "67%", color: "text-profit" },
                { label: "Trades", value: "12", color: "text-foreground" },
                { label: "Streak", value: "7 days", color: "text-primary" },
              ].map((s) => (
                <div key={s.label} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className={`text-sm font-mono font-semibold mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Recent Trades</p>
              {[
                { sym: "EUR/USD", pnl: "+$335", side: "Long", color: "text-profit" },
                { sym: "BTC/USD", pnl: "+$185", side: "Long", color: "text-profit" },
                { sym: "NZD/USD", pnl: "-$108", side: "Short", color: "text-loss" },
              ].map((t) => (
                <div key={t.sym} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-foreground">{t.sym}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${t.side === "Long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>{t.side}</span>
                  </div>
                  <span className={`text-xs font-mono font-medium ${t.color}`}>{t.pnl}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right — AI Coach */}
        <motion.div
          initial={{ opacity: 0, x: 60, rotateY: -8 }}
          animate={{ opacity: 1, x: 0, rotateY: -4 }}
          transition={{ duration: 1.2, delay: 0.6, ease }}
          className="hidden md:block w-56 lg:w-64 shrink-0 mt-8"
        >
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center text-[9px]">🤖</div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">AI Coach</span>
            </div>
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-[10px] text-foreground/80 leading-relaxed">
                Strong execution on EUR/USD. Your London session entries continue to outperform. Consider tightening SL on NZD pairs.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-profit" />
                <span className="text-[9px] text-muted-foreground">Entry timing: excellent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-profit" />
                <span className="text-[9px] text-muted-foreground">Risk management: strong</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-yellow-400" />
                <span className="text-[9px] text-muted-foreground">Position sizing: review</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function LandingHero() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <section className="relative min-h-screen flex flex-col">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-50 flex items-center justify-between px-4 sm:px-6 md:px-12 py-5 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
          <span className="text-foreground text-lg tracking-[0.08em] font-semibold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Momentra
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</Link>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              Sign In
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Get Started
            </Button>
          </Link>
        </div>
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-[60px] z-[60] backdrop-blur-2xl bg-black/90 border-b border-white/[0.08] shadow-2xl md:hidden"
          >
            <div className="p-4 space-y-1">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-white/[0.06] transition-colors">Features</a>
              <Link to="/pricing" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-white/[0.06] transition-colors">Pricing</Link>
              <Link to="/blog" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-white/[0.06] transition-colors">Blog</Link>
              <div className="h-px bg-white/[0.08] my-2" />
              <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-white/[0.06] transition-colors">Sign In</Link>
              <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-primary hover:bg-primary/10 transition-colors">Get Started</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 mt-4 sm:mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
        >
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.1, ease }}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight text-foreground max-w-4xl leading-[1.08]"
        >
          Master Your Trading{" "}
          <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
            With Clarity
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease }}
          className="mt-5 sm:mt-6 text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed px-2"
        >
          Track trades, analyze past decisions, and understand exactly where your trading goes right or wrong — without getting lost in complicated dashboards.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease }}
          className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center gap-3 sm:gap-4"
        >
          <Link to="/auth">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-6 sm:px-8 h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto">
              Start Journaling <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="lg" className="h-11 sm:h-12 text-sm sm:text-base border-white/[0.1] hover:bg-white/[0.05] w-full sm:w-auto">
              See How It Works
            </Button>
          </Link>
        </motion.div>

        {/* Broker logo strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6, ease }}
          className="mt-10 w-full max-w-3xl"
        >
          <BrokerLogoStrip />
        </motion.div>

        <MockDashboard />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown className="h-5 w-5 text-muted-foreground/40" />
        </motion.div>
      </motion.div>
    </section>
  );
}
