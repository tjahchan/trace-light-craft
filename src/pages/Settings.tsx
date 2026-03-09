import { useState, useEffect } from "react";
import { AccountReconciliationPanel } from "@/components/AccountReconciliationPanel";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { usePlan } from "@/contexts/PlanContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBackground } from "@/contexts/BackgroundContext";
import { BackgroundThemeSection } from "@/components/settings/BackgroundThemeSection";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Upload, Trash2, Zap, Crown, CreditCard, ExternalLink, Check, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { theme, setTheme, calendarOpacity, setCalendarOpacity } = useBackground();
  const { user } = useAuth();
  const { streakReminders, weeklyEncouragement, updatePref, loading: prefsLoading } = useNotificationPreferences();
  const {
    plan, isPro, subscriptionStatus, subscriptionEnd,
    csvImportsUsed, aiRequestsUsed, csvLimit, aiLimit,
    startCheckout, openBillingPortal, stripeCustomerId,
  } = usePlan();

  const [username, setUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameLoaded, setUsernameLoaded] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Load profile data
  useEffect(() => {
    if (!user) return;
    setUserEmail(user.email || "");
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setUsername((data as any).username || "");
        setDisplayName(data.display_name || "");
      }
      setUsernameLoaded(true);
    };
    loadProfile();
  }, [user]);

  const handleSaveUsername = async () => {
    if (!user) return;
    if (username && (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username))) {
      toast({ title: "Invalid username", description: "3–20 characters, letters, numbers, and underscore only.", variant: "destructive" });
      return;
    }
    setUsernameSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: username || null, display_name: displayName } as any)
      .eq("user_id", user.id);
    if (error) {
      if (error.message.includes("unique") || error.code === "23505") {
        toast({ title: "Username taken", description: "That username is already in use.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Profile saved" });
    }
    setUsernameSaving(false);
  };

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters.", variant: "destructive" });
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated" });
      setNewPassword("");
    }
    setPasswordSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6 pb-12">
      <h1 className="text-lg font-semibold text-foreground">Settings</h1>

      {/* Profile */}
      <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Profile</h2>
        <div className="grid gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Display Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 bg-white/[0.04] border-white/[0.08]"
              placeholder="Your name"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input value={userEmail} readOnly className="mt-1 bg-white/[0.02] border-white/[0.06] text-muted-foreground" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 bg-white/[0.04] border-white/[0.08]"
              placeholder="trader_pro"
              maxLength={20}
            />
            <p className="text-[10px] text-muted-foreground mt-1">3–20 characters. Letters, numbers, underscore.</p>
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
          <Button onClick={handleSaveUsername} disabled={usernameSaving} className="w-full sm:w-auto gap-2">
            {usernameSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save Profile
          </Button>
        </div>
      </div>

      {/* Preferences */}
      <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Preferences</h2>
        <div>
          <p className="text-xs text-muted-foreground mb-2">Calendar Transparency</p>
          <div className="flex items-center gap-3">
            <Slider
              value={[calendarOpacity]}
              onValueChange={([v]) => setCalendarOpacity(v)}
              min={20}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground font-mono w-10 text-right">{calendarOpacity}%</span>
          </div>
        </div>
      </div>

      {/* Subscription & Billing */}
      <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Subscription & Billing</h2>
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            isPro ? "bg-primary/20" : "bg-white/[0.06]"
          )}>
            {isPro ? <Crown className="h-5 w-5 text-primary" /> : <Zap className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div>
            <p className="text-foreground font-medium">{isPro ? "Pro Plan" : "Free Plan"}</p>
            <p className="text-xs text-muted-foreground">
              {isPro && subscriptionEnd
                ? `Renews ${new Date(subscriptionEnd).toLocaleDateString()}`
                : isPro ? "Active subscription" : "Upgrade to unlock all features"}
            </p>
          </div>
          {isPro && subscriptionStatus === "active" && (
            <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-semibold bg-profit/20 text-profit">ACTIVE</span>
          )}
        </div>

        {!isPro && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-white/[0.03]">
              <p className="text-[10px] text-muted-foreground uppercase">CSV Imports</p>
              <p className="font-mono text-foreground">{csvImportsUsed} / {csvLimit}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.03]">
              <p className="text-[10px] text-muted-foreground uppercase">AI Requests</p>
              <p className="font-mono text-foreground">{aiRequestsUsed} / {aiLimit}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isPro ? (
            <Button onClick={startCheckout} className="gap-2 bg-primary hover:bg-primary/90">
              <Zap className="h-3.5 w-3.5" /> Upgrade to Pro — $14/mo
            </Button>
          ) : (
            <Button variant="outline" onClick={openBillingPortal} className="gap-2 bg-white/[0.04] border-white/[0.08] text-foreground">
              <CreditCard className="h-3.5 w-3.5" /> Manage Billing
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Security */}
      <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Security</h2>
        <div>
          <Label className="text-xs text-muted-foreground">New Password</Label>
          <div className="flex gap-2 mt-1">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-white/[0.04] border-white/[0.08] flex-1"
              minLength={6}
            />
            <Button onClick={handleChangePassword} disabled={passwordSaving || !newPassword} variant="outline" className="gap-1.5 bg-white/[0.04] border-white/[0.08] text-foreground">
              {passwordSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              Update
            </Button>
          </div>
        </div>
      </div>

      {/* Display Theme */}
      <BackgroundThemeSection />

      {/* Notifications */}
      <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5 sm:p-6 space-y-4">
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
      <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5 sm:p-6 space-y-3">
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

      {/* Account Reconciliation Debug */}
      <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-5 sm:p-6">
        <AccountReconciliationPanel />
      </div>

      {/* Danger Zone */}
      <div className="backdrop-blur-xl bg-black/40 border border-loss/20 rounded-2xl p-5 sm:p-6 space-y-3">
        <h2 className="text-sm font-semibold text-loss uppercase tracking-wider">Danger Zone</h2>
        <p className="text-xs text-muted-foreground">Permanently delete your account and all data.</p>
        <Button variant="destructive" size="sm" className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Delete Account
        </Button>
      </div>
    </motion.div>
  );
}
