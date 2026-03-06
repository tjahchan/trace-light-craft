import { motion, type Easing } from "framer-motion";
import { Sparkles, MessageSquare } from "lucide-react";

const ease: Easing = [0.22, 1, 0.36, 1];

function MockAIPanel() {
  const insights = [
    { type: "summary", text: "You took 3 trades this week with a 67% win rate. Your London session entries outperformed New York by 2.1R on average." },
    { type: "strength", label: "Strengths", items: ["Consistent risk management at 1%", "Patience waiting for confirmation", "Clean exit execution on winners"] },
    { type: "improve", label: "Areas to Improve", items: ["Moving stops too early on pullbacks", "Over-sizing on correlated pairs", "Skipping journal on losing trades"] },
    { type: "action", text: "Focus this week: let stops breathe on GBP setups. Your last 4 GBP losses were all stopped out within 5 pips of reversal." },
  ];

  return (
    <div className="glass-card p-6 max-w-md w-full ring-1 ring-primary/10 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">AI Trading Coach</p>
          <p className="text-[10px] text-muted-foreground">Analyzing your recent performance</p>
        </div>
      </div>

      {insights.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 + i * 0.15, ease }}
        >
          {item.type === "summary" && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-xs text-foreground/80 leading-relaxed">{item.text}</p>
            </div>
          )}
          {item.type === "strength" && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-profit uppercase tracking-wider">✅ {item.label}</p>
              {item.items!.map((it) => (
                <p key={it} className="text-[11px] text-muted-foreground pl-4">• {it}</p>
              ))}
            </div>
          )}
          {item.type === "improve" && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-yellow-400 uppercase tracking-wider">⚠️ {item.label}</p>
              {item.items!.map((it) => (
                <p key={it} className="text-[11px] text-muted-foreground pl-4">• {it}</p>
              ))}
            </div>
          )}
          {item.type === "action" && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[10px] font-medium text-primary uppercase tracking-wider mb-1">🎯 This Week's Focus</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{item.text}</p>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function AskAnythingExamples() {
  const examples = [
    "What mistakes do I repeat most?",
    "Summarize my last 10 trades.",
    "Explain risk management.",
    "Why are my London trades more profitable?",
    "Break down my EUR/USD performance.",
  ];

  return (
    <div className="space-y-2 mt-6">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-primary/60" />
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ask anything</p>
      </div>
      {examples.map((q, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -15 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.5 + i * 0.08, ease }}
          className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-primary/20 transition-colors cursor-default"
        >
          <span className="text-primary/50 text-xs">→</span>
          <span className="text-[11px] text-muted-foreground italic">"{q}"</span>
        </motion.div>
      ))}
    </div>
  );
}

export function LandingAI() {
  return (
    <section id="ai-coach" className="relative py-32 px-6 md:px-12">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/8 blur-[180px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative flex flex-col md:flex-row items-center gap-12 md:gap-20">
        <div className="flex-1 space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease }}
          >
            <span className="text-[11px] font-medium text-primary uppercase tracking-[0.2em] mb-4 block">Key Differentiator</span>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">
              Your AI Trading<br />Coach & Analyst
            </h2>
            <p className="mt-4 text-muted-foreground text-base md:text-lg leading-relaxed max-w-md">
              More than a summary tool. Momentra AI is your personal trading analyst and knowledge assistant — it analyzes your trades, answers any trading question, and helps you improve faster.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3, ease }}
            className="space-y-3 pt-4"
          >
            {[
              "Summarize trades and extract key lessons",
              "Detect recurring mistakes and patterns",
              "Answer any trading or strategy question",
              "Explain concepts like risk management and psychology",
              "Generate personalized improvement plans",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </motion.div>

          <AskAnythingExamples />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="flex-1 flex justify-center"
        >
          <MockAIPanel />
        </motion.div>
      </div>
    </section>
  );
}
