import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Download, Upload, Trash2 } from "lucide-react";

const themes = [
  { id: "forest", name: "Forest", desc: "Dark green cinematic", color: "bg-emerald-900/50" },
  { id: "beach", name: "Beach", desc: "Warm golden tones", color: "bg-amber-800/50" },
  { id: "night-city", name: "Night City", desc: "Neon dark vibes", color: "bg-purple-900/50" },
  { id: "minimal", name: "Minimal", desc: "Plain dark", color: "bg-zinc-800/50" },
];

export default function SettingsPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold text-foreground">Settings</h1>

      {/* Account Settings */}
      <div className="glass-card p-5 space-y-4">
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
                <SelectTrigger className="mt-1 bg-white/[0.04] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
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
                <SelectTrigger className="mt-1 bg-white/[0.04] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
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

      {/* Display */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Display Theme</h2>
        <div className="grid grid-cols-2 gap-3">
          {themes.map((theme) => (
            <button
              key={theme.id}
              className={`glass-card-hover p-4 text-left ${theme.id === "forest" ? "ring-1 ring-primary" : ""}`}
            >
              <div className={`h-8 w-full rounded-lg mb-2 ${theme.color}`} />
              <p className="text-sm font-medium text-foreground">{theme.name}</p>
              <p className="text-[10px] text-muted-foreground">{theme.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Notifications</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Streak Reminders</p>
            <p className="text-xs text-muted-foreground">Get notified to log your trades daily</p>
          </div>
          <Switch />
        </div>
      </div>

      {/* Data */}
      <div className="glass-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Data</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-5 border-loss/20 space-y-3">
        <h2 className="text-sm font-semibold text-loss uppercase tracking-wider">Danger Zone</h2>
        <p className="text-xs text-muted-foreground">Permanently delete your account and all data.</p>
        <Button variant="destructive" size="sm" className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Delete Account
        </Button>
      </div>
    </motion.div>
  );
}
