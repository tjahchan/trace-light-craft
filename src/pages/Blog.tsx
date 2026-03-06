import { motion, type Easing } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

const ease: Easing = [0.22, 1, 0.36, 1];

const posts = [
  {
    slug: "broker-auto-sync",
    title: "Broker Auto Sync Is Now Available",
    date: "March 5, 2026",
    excerpt: "Momentra now supports broker auto sync through SnapTrade. Connect your brokerage account and automatically import trades into your journal.",
    featured: true,
    content: [
      "Momentra now supports broker auto sync through SnapTrade.",
      "You can securely connect your brokerage account and automatically import trades into your journal — no more manual entry or CSV uploads.",
      "Supported platforms include:",
      null,
      ["Interactive Brokers", "TD Ameritrade", "Schwab", "Robinhood", "Fidelity", "Wealthsimple", "Coinbase", "Kraken", "Alpaca", "Tradier"],
      "More integrations will continue to be added as SnapTrade expands their broker network.",
      "This feature removes the need for manual trade entry and makes journaling effortless. Connect once, and your trades flow in automatically with full details — symbol, side, entry, exit, and P&L.",
      "Broker sync is available on the Pro plan. Free users can continue using CSV import to log trades.",
    ],
  },
];

export default function Blog() {
  const featured = posts[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="relative z-50 flex items-center justify-between px-6 md:px-12 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
          <span className="text-foreground text-lg tracking-[0.15em]" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}>
            Momentra
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link to="/blog" className="text-sm text-foreground transition-colors">Blog</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Sign In</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">Get Started</Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-12 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
        >
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>

          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-4">Blog</h1>
          <p className="text-muted-foreground mb-16">Product updates, trading insights, and announcements.</p>
        </motion.div>

        {/* Featured post */}
        <motion.article
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease }}
          className="glass-card p-8 space-y-6"
        >
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium text-primary uppercase tracking-wider px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5">Featured</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {featured.date}
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{featured.title}</h2>

          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            {featured.content.map((block, i) => {
              if (block === null) return null;
              if (Array.isArray(block)) {
                return (
                  <ul key={i} className="list-disc pl-5 space-y-1">
                    {block.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                );
              }
              return <p key={i}>{block}</p>;
            })}
          </div>

          <div className="pt-4 border-t border-white/[0.06]">
            <Link to="/auth">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Try Momentra Free
              </Button>
            </Link>
          </div>
        </motion.article>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] py-8 px-6 md:px-12 max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-primary to-primary/40" />
          <span className="text-foreground text-sm tracking-[0.15em]" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}>
            Momentra
          </span>
        </Link>
        <p className="text-xs text-muted-foreground/50">© {new Date().getFullYear()} Momentra. The Trading Performance System.</p>
      </div>
    </div>
  );
}
