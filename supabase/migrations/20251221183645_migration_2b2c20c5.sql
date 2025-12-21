-- Crea bucket per storage logo studio e asset
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'studio-assets',
  'studio-assets',
  true,
  5242880, -- 5MB max
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Policies per accesso pubblico
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'studio-assets');

CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'studio-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'studio-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'studio-assets' AND auth.role() = 'authenticated');