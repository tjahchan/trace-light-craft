
CREATE TABLE public.note_screenshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  label text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.note_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own note screenshots" ON public.note_screenshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own note screenshots" ON public.note_screenshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own note screenshots" ON public.note_screenshots FOR DELETE USING (auth.uid() = user_id);
