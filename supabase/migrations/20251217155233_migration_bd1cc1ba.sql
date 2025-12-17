-- TABELLA TBAgenda (Eventi Agenda)
CREATE TABLE TBAgenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo TEXT NOT NULL,
  descrizione TEXT,
  data_inizio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_fine TIMESTAMP WITH TIME ZONE NOT NULL,
  tutto_giorno BOOLEAN DEFAULT FALSE,
  utente_id UUID REFERENCES TBUtenti(id),
  cliente_id UUID REFERENCES TBClienti(id),
  in_sede BOOLEAN DEFAULT TRUE,
  sala TEXT,
  colore TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBAgenda ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Users can view all eventi" ON TBAgenda FOR SELECT USING (true);
CREATE POLICY "Users can manage eventi" ON TBAgenda FOR ALL USING (auth.uid() IS NOT NULL);