import { motion, type Easing } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const ease: Easing = [0.22, 1, 0.36, 1];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Everything you need to start improving your trading.",
    cta: "Start Free",
    highlighted: false,
    features: [
      { text: "Full trading journal", included: true },
      { text: "Trading library folders", included: true },
      { text: "Trade analytics dashboard", included: true },
      { text: "Performance overview", included: true },
      { text: "Leaderboard access", included: true },
      { text: "CSV import (max 3)", included: true },
      { text: "AI requests (max 3/month)", included: true },
      { text: "Broker auto sync", included: false },
      { text: "Unlimited AI requests", included: false },
      { text: "AI insights in journal", included: false },
      { text: "Unlimited CSV imports", included: false },
    ],
  },
  {
    name: "Pro",
    price: "$14",
    period: "/month",
    desc: "For serious traders who want the full edge.",
    cta: "Upgrade to Pro",
    highlighted: true,
    badge: "Recommended",
    features: [
      { text: "Everything in Free", included: true },
      { text: "Broker auto sync", included: true },
      { text: "Unlimited AI requests", included: true },
      { text: "AI insights inside journal", included: true },
      { text: "Unlimited CSV imports", included: true },
      { text: "Full AI trading coach", included: true },
      { text: "Priority support", included: true },
      { text: "Early access to new features", included: true },
    ],
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="relative z-50 flex items-center justify-between px-4 sm:px-6 md:px-12 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
          <span className="text-foreground text-lg tracking-[0.08em] font-semibold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Momentra
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
          <Link to="/pricing" className="text-sm text-foreground transition-colors">Pricing</Link>
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hidden sm:inline-flex">Sign In</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-20 pb-32 px-6 md:px-12">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/8 blur-[200px] rounded-full pointer-events-none" />

        <div className="max-w-4xl mx-auto relative text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
          >
            <span className="text-[11px] font-medium text-primary uppercase tracking-[0.2em] mb-4 block">Pricing</span>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-foreground tracking-tight">
              Simple, Transparent Pricing
            </h1>
            <p className="mt-5 text-muted-foreground text-base md:text-lg max-w-lg mx-auto">
              Start for free with the full journal. Upgrade when you're ready for broker sync, unlimited AI, and the full trading edge.
            </p>
          </motion.div>
        </div>

        {/* Cards */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 px-2 sm:px-0">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: i * 0.15, ease }}
              className={`relative glass-card p-8 space-y-6 ${plan.highlighted ? "ring-2 ring-primary/30" : ""}`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-medium text-primary-foreground uppercase tracking-wider bg-primary px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{plan.desc}</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold font-mono text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>

              <Link to="/auth" className="block">
                <Button
                  className={`w-full h-12 text-base gap-2 ${
                    plan.highlighted
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-white/[0.05] hover:bg-white/[0.08] text-foreground border border-white/[0.1]"
                  }`}
                >
                  {plan.cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <div className="space-y-3 pt-4 border-t border-white/[0.06]">
                {plan.features.map((f) => (
                  <div key={f.text} className="flex items-center gap-3">
                    {f.included ? (
                      <Check className="h-4 w-4 text-profit shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                    )}
                    <span className={`text-sm ${f.included ? "text-foreground" : "text-muted-foreground/40"}`}>{f.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, ease }}
          className="text-center mt-12 text-xs text-muted-foreground/50"
        >
          No credit card required to start · Cancel anytime
        </motion.p>
      </section>

      {/* Footer */}
      <div className="border-t border-white/[0.06] py-8 px-6 md:px-12 max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-primary to-primary/40" />
          <span className="text-foreground text-sm tracking-[0.15em]" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}>
            Momentra
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/blog" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">Blog</Link>
          <Link to="/auth" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">Sign In</Link>
        </div>
        <p className="text-xs text-muted-foreground/50">© {new Date().getFullYear()} Momentra. The Trading Performance System.</p>
      </div>
    </div>
  );
}
