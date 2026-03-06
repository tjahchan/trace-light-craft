import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, Sparkles, Link2, Brain, FileUp, Check } from "lucide-react";
import { usePlan } from "@/contexts/PlanContext";
import { useNavigate } from "react-router-dom";

const PRO_FEATURES = [
  { icon: Link2, label: "Broker auto sync" },
  { icon: Brain, label: "Unlimited AI requests" },
  { icon: Sparkles, label: "AI insights in journal" },
  { icon: FileUp, label: "Unlimited CSV imports" },
];

export function UpgradeModal() {
  const { showUpgradeModal, setShowUpgradeModal, upgradeReason } = usePlan();
  const navigate = useNavigate();

  return (
    <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
      <DialogContent className="backdrop-blur-xl bg-black/80 border-white/[0.1] max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl text-foreground">Upgrade to Pro</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {upgradeReason || "Unlock broker auto sync, unlimited AI insights, and unlimited trade imports."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {PRO_FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03]">
              <div className="h-7 w-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm text-foreground">{label}</span>
              <Check className="h-3.5 w-3.5 text-primary ml-auto" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={() => {
              setShowUpgradeModal(false);
              navigate("/pricing");
            }}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Zap className="h-4 w-4" /> Upgrade to Pro
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShowUpgradeModal(false)}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
