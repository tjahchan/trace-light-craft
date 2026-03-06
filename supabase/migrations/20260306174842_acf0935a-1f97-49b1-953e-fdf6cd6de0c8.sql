
-- Journal folders table
CREATE TABLE public.journal_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders" ON public.journal_folders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own folders" ON public.journal_folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own folders" ON public.journal_folders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own folders" ON public.journal_folders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Journal entries table (for notes, strategies, reviews - NOT trade journals which use trades table)
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  folder_id uuid REFERENCES public.journal_folders(id) ON DELETE SET NULL,
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled',
  content text DEFAULT '',
  entry_type text NOT NULL DEFAULT 'note',
  is_pinned boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entries" ON public.journal_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own entries" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own entries" ON public.journal_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own entries" ON public.journal_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);
