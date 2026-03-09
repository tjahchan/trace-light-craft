import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, Search, Lock } from "lucide-react";
import { sortedBrokers, getProviderForBroker, type BrokerEntry } from "@/lib/broker-config";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSnapTrade: () => void;
  onSelectTradeLocker: () => void;
}

export function BrokerSelectionModal({ open, onOpenChange, onSelectSnapTrade, onSelectTradeLocker }: Props) {
  const [search, setSearch] = useState("");

  const filtered = sortedBrokers.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (broker: BrokerEntry) => {
    const provider = getProviderForBroker(broker.id);
    if (provider === "tradelocker") {
      onSelectTradeLocker();
    } else if (provider === "snaptrade") {
      onSelectSnapTrade();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-black/60 border-white/[0.1] max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg">Connect Your Broker</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Choose your broker to securely sync trades into Momentra.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brokers..."
            className="pl-9 bg-white/[0.04] border-white/[0.08] text-sm"
          />
        </div>

        {/* Broker Grid */}
        <div className="flex-1 overflow-y-auto mt-2 -mx-1 px-1 min-h-0">
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((broker) => (
              <button
                key={broker.id}
                onClick={() => handleSelect(broker)}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] transition-all group cursor-pointer text-left"
              >
                <div className="h-10 w-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                  {broker.logo ? (
                    <img
                      src={broker.logo}
                      alt={broker.name}
                      className="h-7 w-7 object-contain rounded-md"
                      loading="lazy"
                    />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <span className="text-sm font-medium text-foreground truncate">{broker.name}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No brokers found for "{search}"</p>
              <p className="text-xs text-muted-foreground/60 mt-1">More brokers are being added regularly.</p>
            </div>
          )}
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
