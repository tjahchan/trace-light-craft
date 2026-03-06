
-- Create trade_edits audit log table
CREATE TABLE public.trade_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID NOT NULL,
  user_id UUID NOT NULL,
  changed_fields JSONB NOT NULL DEFAULT '{}',
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trade_edits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can insert own trade edits"
  ON public.trade_edits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own trade edits"
  ON public.trade_edits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
