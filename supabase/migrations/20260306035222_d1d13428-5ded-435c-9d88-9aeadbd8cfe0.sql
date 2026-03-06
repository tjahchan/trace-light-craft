
-- Community posts table
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  likes integer NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE DEFAULT NULL
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Anyone can read posts"
  ON public.community_posts FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own posts
CREATE POLICY "Users can insert own posts"
  ON public.community_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update own posts (for likes we'll use a function)
CREATE POLICY "Users can update own posts"
  ON public.community_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete own posts
CREATE POLICY "Users can delete own posts"
  ON public.community_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;

-- Like function (anyone can like any post)
CREATE OR REPLACE FUNCTION public.like_post(post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE community_posts SET likes = likes + 1 WHERE id = post_id;
END;
$$;

-- Leaderboard function: streak ranking
CREATE OR REPLACE FUNCTION public.get_streak_leaderboard(p_limit integer DEFAULT 10, p_offset integer DEFAULT 0)
RETURNS TABLE(rank bigint, display_name text, email text, current_streak integer, best_streak integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY us.current_streak DESC, us.best_streak DESC) as rank,
    COALESCE(p.display_name, split_part(p.email, '@', 1)) as display_name,
    p.email,
    us.current_streak,
    us.best_streak
  FROM user_streaks us
  JOIN profiles p ON p.user_id = us.user_id
  WHERE us.current_streak > 0
  ORDER BY us.current_streak DESC, us.best_streak DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- Seed starter messages (using a placeholder system user id)
INSERT INTO community_posts (id, user_id, username, content, created_at, likes) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'TraderAlex', 'Anyone else watching the EUR/USD breakout? Clean setup forming on the 4H chart. Thinking about going long at the retest. 📈', now() - interval '2 hours', 12),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'SwingKing', 'Just hit my 20-day streak! Journaling every trade has been a game changer for my discipline. Keep at it everyone 🔥', now() - interval '5 hours', 24),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'ForexNova', 'Risk management tip: Never risk more than 1% on a single trade. It sounds boring but it keeps you in the game long enough to actually get good.', now() - interval '1 day', 31),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'ChartWhisperer', 'Backtested my breakout strategy over 200 trades — 62% win rate with 1.8R average. The edge is real if you stay consistent.', now() - interval '2 days', 18),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'PipHunter', 'Morning routine: review yesterday''s trades, mark levels on the daily, then wait. Patience is the hardest skill in trading. 🧘', now() - interval '3 days', 15);
