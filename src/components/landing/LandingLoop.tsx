import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const ease = [0.22, 1, 0.36, 1];

const steps = [
  { emoji: "📊", label: "Trade", desc: "Execute your strategy" },
  { emoji: "📝", label: "Journal", desc: "Record and reflect" },
  { emoji: "🔍", label: "Analyze", desc: "Find patterns" },
  { emoji: "🚀", label: "Improve", desc: "Refine your edge" },
];

export function LandingLoop() {
  return (
    <section className="relative py-32 px-6 md:px-12">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease }}
        >
          <span className="text-[11px] font-medium text-primary uppercase tracking-[0.2em] mb-4 block">The System</span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">
            How Traders Improve
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-base">
            Momentra supports the full performance cycle. Every trade becomes a learning opportunity.
          </p>
        </motion.div>

        <div className="mt-16 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-2">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2 md:gap-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12, ease }}
                className="glass-card p-6 w-40 text-center group hover:border-primary/20 transition-colors"
              >
                <span className="text-2xl block mb-2">{step.emoji}</span>
                <p className="text-sm font-semibold text-foreground">{step.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{step.desc}</p>
              </motion.div>
              {i < steps.length - 1 && (
                <ArrowRight className="h-4 w-4 text-primary/40 hidden md:block shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Loop arrow visual */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6, ease }}
          className="mt-8 flex justify-center"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/15 bg-primary/5">
            <span className="text-[10px] text-primary font-medium uppercase tracking-wider">Continuous improvement loop</span>
            <span className="text-primary text-xs">↻</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
