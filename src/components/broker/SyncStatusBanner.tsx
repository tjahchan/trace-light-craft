import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  syncingConnectionId: string | null;
}

export function SyncStatusBanner({ syncingConnectionId }: Props) {
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
            <p className="text-sm text-foreground font-medium">Syncing trades…</p>
            <p className="text-xs text-muted-foreground">Importing your latest account activity. This may take a moment.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
