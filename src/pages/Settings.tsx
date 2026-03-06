import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Upload, Trash2 } from "lucide-react";
import { useBackground, backgrounds, BackgroundTheme } from "@/contexts/BackgroundContext";

export default function SettingsPage() {
  const { theme, setTheme } = useBackground();
  const { streakReminders, weeklyEncouragement, updatePref, loading: prefsLoading } = useNotificationPreferences();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold text-foreground">Settings</h1>

      {/* Account Settings */}
      <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Account</h2>
        <div className="grid gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input defaultValue="Trader" className="mt-1 bg-white/[0.04] border-white/[0.08]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input defaultValue="trader@example.com" className="mt-1 bg-white/[0.04] border-white/[0.08]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Primary Currency</Label>
              <Select defaultValue="usd">
                <SelectTrigger className="mt-1 bg-white/[0.04] border-white/[0.08]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD</SelectItem>
                  <SelectItem value="eur">EUR</SelectItem>
                  <SelectItem value="gbp">GBP</SelectItem>
                  <SelectItem value="cad">CAD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Timezone</Label>
              <Select defaultValue="utc">
                <SelectTrigger className="mt-1 bg-white/[0.04] border-white/[0.08]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="utc">UTC</SelectItem>
                  <SelectItem value="est">EST (UTC-5)</SelectItem>
                  <SelectItem value="gmt">GMT (UTC+0)</SelectItem>
                  <SelectItem value="jst">JST (UTC+9)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Display Theme */}
      <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Background Theme</h2>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(backgrounds) as BackgroundTheme[]).map((key) => {
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
        </div>
      </div>

      {/* Notifications */}
      <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Notifications</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Streak Reminders</p>
            <p className="text-xs text-muted-foreground">Daily email reminders when you miss logging a note</p>
          </div>
          <Switch
            checked={streakReminders}
            disabled={prefsLoading}
            onCheckedChange={(v) => updatePref("streak_reminders", v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Weekly Encouragement</p>
            <p className="text-xs text-muted-foreground">Sunday summary with your streak and trading stats</p>
          </div>
          <Switch
            checked={weeklyEncouragement}
            disabled={prefsLoading}
            onCheckedChange={(v) => updatePref("weekly_encouragement", v)}
          />
        </div>
      </div>

      {/* Data */}
      <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Data</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground">
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="backdrop-blur-xl bg-black/40 border border-loss/20 rounded-2xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-loss uppercase tracking-wider">Danger Zone</h2>
        <p className="text-xs text-muted-foreground">Permanently delete your account and all data.</p>
        <Button variant="destructive" size="sm" className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Delete Account
        </Button>
      </div>
    </motion.div>
  );
}
