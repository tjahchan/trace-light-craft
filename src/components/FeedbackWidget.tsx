import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const feedbackTypes = [
  { id: "suggestion", icon: "💡", label: "Suggestion" },
  { id: "bug", icon: "🐛", label: "Bug Report" },
  { id: "general", icon: "❤️", label: "General" },
] as const;

type FeedbackType = (typeof feedbackTypes)[number]["id"];

interface FeedbackWidgetProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export function FeedbackWidget({ externalOpen, onExternalClose }: FeedbackWidgetProps) {
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!externalOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onExternalClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [externalOpen, onExternalClose]);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("feedback").insert({
        user_id: user?.id,
        type,
        message: message.trim(),
        email: email.trim() || user?.email || null,
      } as any);
      if (error) throw error;
      setSubmitted(true);
      setTimeout(() => {
        onExternalClose?.();
        setSubmitted(false);
        setMessage("");
        setType("suggestion");
      }, 2000);
    } catch {
      toast({ title: "Error", description: "Could not submit feedback.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {externalOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          className="fixed bottom-16 left-4 z-[300] backdrop-blur-xl bg-black/70 border border-white/[0.1] rounded-2xl p-5 w-80 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Share Feedback</span>
            <button onClick={onExternalClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {submitted ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-lg">🎉</p>
              <p className="text-sm text-foreground">Thanks for your feedback!</p>
              <p className="text-xs text-muted-foreground">We read every submission.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-1.5">
                {feedbackTypes.map((ft) => (
                  <button
                    key={ft.id}
                    onClick={() => setType(ft.id)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      type === ft.id
                        ? "bg-primary/20 text-foreground ring-1 ring-primary/40"
                        : "bg-white/[0.06] text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {ft.icon} {ft.label}
                  </button>
                ))}
              </div>

              <Textarea
                placeholder="Tell us what you think..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-foreground min-h-[80px] text-sm"
              />

              <Input
                type="email"
                placeholder="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-foreground text-sm"
              />

              <Button
                className="w-full text-xs"
                onClick={handleSubmit}
                disabled={!message.trim() || submitting}
              >
                {submitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
