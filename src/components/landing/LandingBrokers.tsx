import { motion, type Easing } from "framer-motion";
import { Link2, RefreshCw, Shield } from "lucide-react";

const ease: Easing = [0.22, 1, 0.36, 1];

const brokers = [
  "Interactive Brokers", "TD Ameritrade", "Alpaca", "Tradier",
  "Questrade", "Wealthsimple", "Robinhood", "Schwab",
  "Fidelity", "E*TRADE", "Coinbase", "Kraken",
];

export function LandingBrokers() {
  return (
    <section className="relative py-32 px-6 md:px-12">
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-primary/5 blur-[180px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease }}
          className="text-center mb-16"
        >
          <span className="text-[11px] font-medium text-primary uppercase tracking-[0.2em] mb-4 block">Integrations</span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">
            Connect Your Broker
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-base md:text-lg">
            Auto-sync trades from your brokerage. No manual entry needed. Connect once, and your trades flow in automatically.
          </p>
        </motion.div>

        <div className="grid grid-cols-3 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-16">
          {[
            { icon: Link2, title: "One-Click Connect", desc: "Link your broker securely through our partner SnapTrade" },
            { icon: RefreshCw, title: "Auto Sync", desc: "Trades import automatically — no CSV uploads needed" },
            { icon: Shield, title: "Bank-Grade Security", desc: "Read-only access. Your credentials are never stored." },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease }}
              className="glass-card p-5 text-center space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <item.icon className="h-5 w-5 text-primary/70" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Broker grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2, ease }}
          className="glass-card p-6 max-w-3xl mx-auto"
        >
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider text-center mb-4">Supported Brokers via SnapTrade</p>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {brokers.map((b, i) => (
              <motion.div
                key={b}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.04, ease }}
                className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center hover:border-primary/20 transition-colors"
              >
                <span className="text-[11px] font-medium text-muted-foreground">{b}</span>
              </motion.div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground/50 text-center mt-4">+ many more through SnapTrade integration</p>
        </motion.div>
      </div>
    </section>
  );
}
