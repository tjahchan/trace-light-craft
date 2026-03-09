import { useState, useRef } from "react";
import { Upload, Crown, Loader2, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBackground, backgrounds, BackgroundTheme } from "@/contexts/BackgroundContext";
import { usePlan } from "@/contexts/PlanContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function BackgroundThemeSection() {
  const { theme, setTheme, customBackgroundUrl, setCustomBackgroundUrl } = useBackground();
  const { isPro } = usePlan();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Invalid format", description: "Use JPG, PNG, or WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Maximum 10MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/background.${ext}`;

    const { error } = await supabase.storage
      .from("custom-backgrounds")
      .upload(path, file, { upsert: true });

    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("custom-backgrounds").getPublicUrl(path);
    const url = `${urlData.publicUrl}?t=${Date.now()}`;
    setCustomBackgroundUrl(url);
    setTheme("custom");
    toast({ title: "Custom background set!" });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemoveCustom = async () => {
    if (!user) return;
    // Delete all files in user folder
    const { data: files } = await supabase.storage.from("custom-backgrounds").list(user.id);
    if (files && files.length > 0) {
      await supabase.storage.from("custom-backgrounds").remove(files.map(f => `${user.id}/${f.name}`));
    }
    setCustomBackgroundUrl(null);
    if (theme === "custom") setTheme("forest");
    toast({ title: "Custom background removed" });
  };

  return (
    <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5 sm:p-6 space-y-4">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Background Theme</h2>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(backgrounds) as Exclude<BackgroundTheme, "custom">[]).map((key) => {
          const bg = backgrounds[key];
          return (
            <button
              key={key}
              onClick={() => setTheme(key)}
              className={`rounded-2xl p-4 text-left transition-all border ${
                theme === key
                  ? "border-primary bg-white/[0.06] ring-1 ring-primary"
                  : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              {bg.image ? (
                <div className="h-16 w-full rounded-lg mb-2 bg-cover bg-center" style={{ backgroundImage: `url(${bg.image})` }} />
              ) : (
                <div className="h-16 w-full rounded-lg mb-2 bg-background border border-white/[0.1]" />
              )}
              <p className="text-sm font-medium text-foreground">{bg.label}</p>
              <p className="text-[10px] text-muted-foreground">{bg.desc}</p>
            </button>
          );
        })}

        {/* Custom Background - Pro Only */}
        {isPro ? (
          <button
            onClick={() => {
              if (customBackgroundUrl) {
                setTheme("custom");
              } else {
                fileRef.current?.click();
              }
            }}
            className={`rounded-2xl p-4 text-left transition-all border ${
              theme === "custom"
                ? "border-primary bg-white/[0.06] ring-1 ring-primary"
                : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
            }`}
          >
            {customBackgroundUrl ? (
              <div className="h-16 w-full rounded-lg mb-2 bg-cover bg-center" style={{ backgroundImage: `url(${customBackgroundUrl})` }} />
            ) : (
              <div className="h-16 w-full rounded-lg mb-2 bg-white/[0.03] border border-dashed border-white/[0.15] flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Crown className="h-3 w-3 text-primary" />
              <p className="text-sm font-medium text-foreground">Custom</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Upload your own</p>
          </button>
        ) : (
          <div className="rounded-2xl p-4 text-left border border-white/[0.08] bg-white/[0.02] opacity-50 cursor-not-allowed">
            <div className="h-16 w-full rounded-lg mb-2 bg-white/[0.03] border border-dashed border-white/[0.1] flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div className="flex items-center gap-1.5">
              <Crown className="h-3 w-3 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Custom</p>
            </div>
            <p className="text-[10px] text-muted-foreground/60">Pro feature</p>
          </div>
        )}
      </div>

      {/* Upload / Remove controls for custom */}
      {isPro && customBackgroundUrl && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="gap-1.5 bg-white/[0.04] border-white/[0.08] text-foreground"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Replace
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveCustom}
            className="gap-1.5 bg-white/[0.04] border-white/[0.08] text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
