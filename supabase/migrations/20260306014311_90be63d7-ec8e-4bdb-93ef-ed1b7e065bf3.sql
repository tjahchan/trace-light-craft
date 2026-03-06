
-- User streaks table
CREATE TABLE public.user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  last_note_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streak" ON public.user_streaks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streak" ON public.user_streaks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streak" ON public.user_streaks FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Notification preferences table
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  streak_reminders boolean NOT NULL DEFAULT true,
  weekly_encouragement boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prefs" ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own prefs" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own prefs" ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Trigger for updated_at on user_streaks
CREATE TRIGGER update_user_streaks_updated_at BEFORE UPDATE ON public.user_streaks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create streak row on new user
CREATE OR REPLACE FUNCTION public.handle_new_user_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_streaks (user_id) VALUES (NEW.id);
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_streak
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_streak();

-- Function to record note activity and update streak
CREATE OR REPLACE FUNCTION public.record_note_activity(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := current_date;
  v_streak user_streaks%ROWTYPE;
  v_result json;
BEGIN
  -- Get or create streak record
  SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, best_streak, last_active_date, last_note_date)
    VALUES (p_user_id, 1, 1, v_today, v_today)
    RETURNING * INTO v_streak;
    RETURN json_build_object('current_streak', 1, 'best_streak', 1);
  END IF;

  -- Already recorded today
  IF v_streak.last_note_date = v_today THEN
    RETURN json_build_object('current_streak', v_streak.current_streak, 'best_streak', v_streak.best_streak);
  END IF;

  -- Check if yesterday was the last note date (continue streak)
  IF v_streak.last_note_date = v_today - 1 THEN
    UPDATE user_streaks
    SET current_streak = current_streak + 1,
        best_streak = GREATEST(best_streak, current_streak + 1),
        last_active_date = v_today,
        last_note_date = v_today
    WHERE user_id = p_user_id
    RETURNING * INTO v_streak;
  ELSE
    -- Streak broken, reset to 1
    UPDATE user_streaks
    SET current_streak = 1,
        last_active_date = v_today,
        last_note_date = v_today
    WHERE user_id = p_user_id
    RETURNING * INTO v_streak;
  END IF;

  RETURN json_build_object('current_streak', v_streak.current_streak, 'best_streak', v_streak.best_streak);
END;
$$;
