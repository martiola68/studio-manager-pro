-- 1. Aggiungi colonna tipo e titolo a tbconversazioni per supportare gruppi
DO $$ 
BEGIN
  -- Aggiungi colonna tipo se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tbconversazioni' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE tbconversazioni ADD COLUMN tipo TEXT DEFAULT 'diretta' CHECK (tipo IN ('diretta', 'gruppo'));
  END IF;

  -- Aggiungi colonna titolo se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tbconversazioni' AND column_name = 'titolo'
  ) THEN
    ALTER TABLE tbconversazioni ADD COLUMN titolo TEXT;
  END IF;

  -- Aggiungi colonna creato_da se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tbconversazioni' AND column_name = 'creato_da'
  ) THEN
    ALTER TABLE tbconversazioni ADD COLUMN creato_da UUID REFERENCES tbutenti(id);
  END IF;
END $$;

-- 2. Crea tabella allegati messaggi
CREATE TABLE IF NOT EXISTS tbmessaggi_allegati (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  messaggio_id UUID NOT NULL REFERENCES tbmessaggi(id) ON DELETE CASCADE,
  nome_file TEXT NOT NULL,
  tipo_file TEXT NOT NULL,
  dimensione INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Abilita RLS su allegati
ALTER TABLE tbmessaggi_allegati ENABLE ROW LEVEL SECURITY;

-- 4. Policy per vedere allegati (se puoi vedere il messaggio)
CREATE POLICY "Users can view attachments of their messages" ON tbmessaggi_allegati
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tbmessaggi m
    WHERE m.id = tbmessaggi_allegati.messaggio_id
    AND is_chat_participant(m.conversazione_id)
  )
);

-- 5. Policy per inserire allegati (se puoi scrivere nella conversazione)
CREATE POLICY "Users can add attachments to their messages" ON tbmessaggi_allegati
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tbmessaggi m
    WHERE m.id = tbmessaggi_allegati.messaggio_id
    AND m.mittente_id = auth.uid()
  )
);

-- 6. Policy per eliminare allegati (solo il mittente)
CREATE POLICY "Users can delete their attachments" ON tbmessaggi_allegati
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM tbmessaggi m
    WHERE m.id = tbmessaggi_allegati.messaggio_id
    AND m.mittente_id = auth.uid()
  )
);

-- 7. Crea bucket storage per allegati messaggi se non esiste
INSERT INTO storage.buckets (id, name, public)
VALUES ('messaggi-allegati', 'messaggi-allegati', false)
ON CONFLICT (id) DO NOTHING;

-- 8. Policy storage: gli utenti autenticati possono caricare
CREATE POLICY "Authenticated users can upload message attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'messaggi-allegati');

-- 9. Policy storage: gli utenti possono vedere i propri allegati
CREATE POLICY "Users can view their message attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'messaggi-allegati');

-- 10. Policy storage: gli utenti possono eliminare i propri allegati
CREATE POLICY "Users can delete their message attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'messaggi-allegati' AND auth.uid()::text = (storage.foldername(name))[1]);