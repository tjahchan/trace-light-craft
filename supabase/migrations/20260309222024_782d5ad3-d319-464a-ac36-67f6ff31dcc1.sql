
-- Create storage bucket for custom backgrounds
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('custom-backgrounds', 'custom-backgrounds', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can upload their own backgrounds
CREATE POLICY "Users can upload own backgrounds"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'custom-backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can update their own backgrounds
CREATE POLICY "Users can update own backgrounds"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'custom-backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can delete their own backgrounds
CREATE POLICY "Users can delete own backgrounds"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'custom-backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Anyone can view custom backgrounds (public bucket)
CREATE POLICY "Anyone can view custom backgrounds"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'custom-backgrounds');
