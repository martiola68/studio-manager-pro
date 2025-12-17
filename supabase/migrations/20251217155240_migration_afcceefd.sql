-- TABELLA TBComunicazioni (Newsletter e Mailing)
CREATE TABLE TBComunicazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oggetto TEXT NOT NULL,
  messaggio TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('Newsletter', 'Scadenze')) NOT NULL,
  data_invio TIMESTAMP WITH TIME ZONE,
  stato TEXT CHECK (stato IN ('Bozza', 'Inviata', 'Programmata')) DEFAULT 'Bozza',
  allegati JSONB,
  destinatari_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBComunicazioni ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Users can view all comunicazioni" ON TBComunicazioni FOR SELECT USING (true);
CREATE POLICY "Users can manage comunicazioni" ON TBComunicazioni FOR ALL USING (auth.uid() IS NOT NULL);