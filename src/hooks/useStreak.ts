import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface StreakData {
  currentStreak: number;
  bestStreak: number;
  lastNoteDate: string | null;
  loading: boolean;
}

export function useStreak() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    bestStreak: 0,
    lastNoteDate: null,
    loading: true,
  });

  const fetchStreak = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("user_streaks")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      // Check if streak should be reset (missed yesterday)
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const lastNote = data.last_note_date;

      let currentStreak = data.current_streak;
      if (lastNote && lastNote !== today && lastNote !== yesterday) {
        currentStreak = 0; // Streak broken on client side display
      }

      setStreak({
        currentStreak,
        bestStreak: data.best_streak,
        lastNoteDate: data.last_note_date,
        loading: false,
      });
    } else {
      setStreak((s) => ({ ...s, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  const recordNoteActivity = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("record_note_activity", {
      p_user_id: user.id,
    });
    if (data && !error) {
      setStreak((s) => ({
        ...s,
        currentStreak: (data as any).current_streak,
        bestStreak: (data as any).best_streak,
        lastNoteDate: new Date().toISOString().split("T")[0],
      }));
    }
  }, [user]);

  // Get week activity dots
  const getWeekDots = useCallback(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

    const dots: boolean[] = [];
    const lastNote = streak.lastNoteDate ? new Date(streak.lastNoteDate) : null;

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];

      if (d > today) {
        dots.push(false);
      } else if (lastNote && streak.currentStreak > 0) {
        // Estimate: if streak is N and last note was on date X, 
        // then days X, X-1, ..., X-(N-1) are active
        const lastNoteDate = new Date(streak.lastNoteDate!);
        const diffDays = Math.floor((lastNoteDate.getTime() - d.getTime()) / 86400000);
        dots.push(diffDays >= 0 && diffDays < streak.currentStreak);
      } else {
        dots.push(false);
      }
    }
    return dots;
  }, [streak]);

  return { ...streak, recordNoteActivity, getWeekDots };
}
