-- Crea bucket per allegati promemoria
INSERT INTO storage.buckets (id, name, public)
VALUES ('promemoria-allegati', 'promemoria-allegati', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Tutti possono vedere gli allegati
CREATE POLICY "Tutti possono vedere allegati" ON storage.objects
FOR SELECT USING (bucket_id = 'promemoria-allegati');

-- Policy: Utenti autenticati possono caricare
CREATE POLICY "Utenti autenticati possono caricare" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'promemoria-allegati' AND
  auth.uid() IS NOT NULL
);

-- Policy: Utenti possono eliminare i propri allegati
CREATE POLICY "Utenti possono eliminare propri allegati" ON storage.objects
FOR DELETE USING (
  bucket_id = 'promemoria-allegati' AND
  auth.uid() IS NOT NULL
);