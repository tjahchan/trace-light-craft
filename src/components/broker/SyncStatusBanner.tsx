import { Loader2, CheckCircle2, AlertTriangle, FileSearch } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  syncingConnectionId: string | null;
  syncPhase?: string | null;
}

const phaseLabels: Record<string, { label: string; detail: string }> = {
  fetching_history: { label: "Fetching trade history…", detail: "Retrieving your historical closed trades from the broker." },
  importing_trades: { label: "Importing closed trades…", detail: "Mapping and saving your historical trades." },
  importing_positions: { label: "Importing open positions…", detail: "Fetching your currently open positions." },
  complete: { label: "Sync complete", detail: "All trades have been imported successfully." },
  completed_no_data: { label: "Sync complete — no new trades found", detail: "No new trades were found since the last sync." },
  failed: { label: "Sync failed", detail: "An error occurred during sync. Please try again." },
};

export function SyncStatusBanner({ syncingConnectionId, syncPhase }: Props) {
  const phase = syncPhase ? phaseLabels[syncPhase] : null;

  return (
    <AnimatePresence>
      {syncingConnectionId && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <div>
            <p className="text-sm text-foreground font-medium">
              {phase?.label || "Syncing trades…"}
            </p>
            <p className="text-xs text-muted-foreground">
              {phase?.detail || "Importing your latest account activity. This may take a moment."}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
