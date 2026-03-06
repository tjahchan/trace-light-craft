import { useState, useRef } from "react";
import { ImagePlus, X, Expand, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface Screenshot {
  id: string;
  storage_path: string;
  label: string;
  url: string;
}

interface ChartScreenshotsProps {
  screenshots: Screenshot[];
  tradeId: string;
  userId: string;
  onUploaded: () => void;
  onDeleted: (id: string) => void;
}

export function ChartScreenshots({ screenshots, tradeId, userId, onUploaded, onDeleted }: ChartScreenshotsProps) {
  const [uploading, setUploading] = useState(false);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${tradeId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chart-screenshots")
        .upload(path, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      await supabase.from("trade_screenshots" as any).insert({
        trade_id: tradeId,
        user_id: userId,
        storage_path: path,
        label: file.name.replace(/\.[^.]+$/, ""),
        sort_order: screenshots.length,
      });
    }

    setUploading(false);
    onUploaded();
  };

  const handleDelete = async (screenshot: Screenshot) => {
    await supabase.storage.from("chart-screenshots").remove([screenshot.storage_path]);
    await supabase.from("trade_screenshots" as any).delete().eq("id", screenshot.id);
    onDeleted(screenshot.id);
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Chart Screenshots</p>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {screenshots.map((s) => (
          <div key={s.id} className="relative group shrink-0 w-32 h-20 rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.02]">
            <img src={s.url} alt={s.label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button onClick={() => setExpandedUrl(s.url)} className="p-1 rounded bg-white/20 hover:bg-white/30">
                <Expand className="h-3 w-3 text-white" />
              </button>
              <button onClick={() => handleDelete(s)} className="p-1 rounded bg-white/20 hover:bg-destructive/60">
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
            <p className="absolute bottom-0 left-0 right-0 text-[8px] text-white/70 bg-black/40 px-1 py-0.5 truncate">{s.label}</p>
          </div>
        ))}

        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "shrink-0 w-32 h-20 rounded-lg border-2 border-dashed border-white/[0.1] flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-white/[0.2] transition-colors",
            uploading && "opacity-50 pointer-events-none"
          )}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-4 w-4" />
              <span className="text-[9px]">Add Chart</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      <Dialog open={!!expandedUrl} onOpenChange={() => setExpandedUrl(null)}>
        <DialogContent className="bg-card border-white/[0.1] max-w-4xl p-2">
          {expandedUrl && <img src={expandedUrl} alt="Chart" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
