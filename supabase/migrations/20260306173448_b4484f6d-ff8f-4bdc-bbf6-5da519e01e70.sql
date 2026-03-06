
-- Journal metadata table for structured reflection data
CREATE TABLE public.trade_journal_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emotion_before text,
  emotion_after text,
  confidence integer DEFAULT 5,
  execution integer DEFAULT 5,
  discipline integer DEFAULT 5,
  strategy text DEFAULT '',
  setup text DEFAULT '',
  session text DEFAULT '',
  mistakes text[] DEFAULT '{}',
  what_went_well text DEFAULT '',
  what_went_wrong text DEFAULT '',
  lessons_learned text DEFAULT '',
  improvements text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(trade_id)
);

ALTER TABLE public.trade_journal_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal metadata" ON public.trade_journal_metadata FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journal metadata" ON public.trade_journal_metadata FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journal metadata" ON public.trade_journal_metadata FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journal metadata" ON public.trade_journal_metadata FOR DELETE USING (auth.uid() = user_id);

-- Chart screenshots tracking table
CREATE TABLE public.trade_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  label text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trade_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own screenshots" ON public.trade_screenshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own screenshots" ON public.trade_screenshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own screenshots" ON public.trade_screenshots FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for chart screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('chart-screenshots', 'chart-screenshots', true);

CREATE POLICY "Users can upload chart screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chart-screenshots' AND auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can view chart screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'chart-screenshots');
CREATE POLICY "Users can delete own chart screenshots" ON storage.objects FOR DELETE USING (bucket_id = 'chart-screenshots' AND auth.uid() IS NOT NULL);
