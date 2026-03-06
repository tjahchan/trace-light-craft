import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1];

export function LandingCTA() {
  return (
    <section className="relative py-32 px-6 md:px-12">
      {/* Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-3xl mx-auto relative text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="space-y-6"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">
            Your Edge Is Built<br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
              One Trade at a Time
            </span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-md mx-auto">
            The best traders review their performance every day. Start building your trading edge with Momentra.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link to="/auth">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8 h-12 text-base">
                Start Journaling <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/60 pt-4">
            Free to use · No credit card required
          </p>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="mt-32 border-t border-white/[0.06] pt-8 max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-primary to-primary/40" />
          <span className="text-foreground text-sm tracking-[0.15em]" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}>
            Momentra
          </span>
        </div>
        <p className="text-xs text-muted-foreground/50">
          © {new Date().getFullYear()} Momentra. The Trading Performance System.
        </p>
      </div>
    </section>
  );
}
