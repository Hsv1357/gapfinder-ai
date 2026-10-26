-- Supabase Storage Setup for Study Materials

-- 1. Create storage bucket for study materials if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'study-materials',
  'study-materials',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'text/plain', 'text/markdown']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS Policies: users can only upload/view/delete their own folder
CREATE POLICY "Users can upload their own study materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'study-materials' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own study materials"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'study-materials' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own study materials"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'study-materials' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
