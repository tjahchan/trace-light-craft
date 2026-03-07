import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link2, Shield, ArrowRight } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSnapTrade: () => void;
  onSelectTradeLocker: () => void;
}

export function BrokerSelectionModal({ open, onOpenChange, onSelectSnapTrade, onSelectTradeLocker }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-black/60 border-white/[0.1] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg">Connect Your Broker</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Choose how you'd like to connect your brokerage to Momentra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* SnapTrade */}
          <button
            onClick={onSelectSnapTrade}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] transition-all group cursor-pointer text-left"
          >
            <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">SnapTrade</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Connect supported brokers and auto-sync your trades securely.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </button>

          {/* TradeLocker */}
          <button
            onClick={onSelectTradeLocker}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] transition-all group cursor-pointer text-left"
          >
            <div className="h-11 w-11 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">TradeLocker</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Connect your TradeLocker account and import your orders and positions.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </button>
        </div>

        {/* Trust note */}
        <div className="flex items-start gap-2.5 mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">Read-only access only.</span>{" "}
            Momentra cannot execute trades or place orders on your behalf.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
