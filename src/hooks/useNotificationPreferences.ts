import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationPrefs {
  streakReminders: boolean;
  weeklyEncouragement: boolean;
  loading: boolean;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    streakReminders: true,
    weeklyEncouragement: true,
    loading: true,
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            streakReminders: data.streak_reminders,
            weeklyEncouragement: data.weekly_encouragement,
            loading: false,
          });
        } else {
          setPrefs((p) => ({ ...p, loading: false }));
        }
      });
  }, [user]);

  const updatePref = useCallback(
    async (key: "streak_reminders" | "weekly_encouragement", value: boolean) => {
      if (!user) return;
      await supabase
        .from("notification_preferences")
        .upsert({ user_id: user.id, [key]: value }, { onConflict: "user_id" });

      setPrefs((p) => ({
        ...p,
        streakReminders: key === "streak_reminders" ? value : p.streakReminders,
        weeklyEncouragement: key === "weekly_encouragement" ? value : p.weeklyEncouragement,
      }));
    },
    [user]
  );

  return { ...prefs, updatePref };
}
