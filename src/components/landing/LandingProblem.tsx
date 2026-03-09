import { motion, type Easing } from "framer-motion";
import { Brain, Eye, TrendingDown } from "lucide-react";

const ease: Easing = [0.22, 1, 0.36, 1];
const fadeUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" as const },
  transition: { duration: 0.7, ease },
};

const problems = [
  {
    icon: Brain,
    title: "Forget why they entered",
    desc: "Trades blur together. Without structured records, the reasoning behind each decision fades within hours.",
  },
  {
    icon: Eye,
    title: "Ignore emotional mistakes",
    desc: "FOMO, revenge trading, overconfidence — the patterns repeat because they're never tracked or confronted.",
  },
  {
    icon: TrendingDown,
    title: "Fail to track patterns",
    desc: "Without data on what works, traders keep guessing. Performance plateaus become permanent.",
  },
];

export function LandingProblem() {
  return (
    <section className="relative py-20 sm:py-32 px-4 sm:px-6 md:px-12">
      <div className="max-w-5xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-16">
          <span className="text-[11px] font-medium text-loss uppercase tracking-[0.2em] mb-4 block">The Reality</span>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground tracking-tight">
            Most Traders Never Improve
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-base md:text-lg">
            Most traders repeat the same mistakes because they never review their decisions.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {problems.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: i * 0.12, ease }}
              className="glass-card p-6 group hover:border-loss/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-loss/10 flex items-center justify-center mb-4 group-hover:bg-loss/15 transition-colors">
                <p.icon className="h-5 w-5 text-loss/70" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5, ease }}
          className="text-center mt-12 text-primary font-medium text-lg"
        >
          Momentra fixes that.
        </motion.p>
      </div>
    </section>
  );
}
