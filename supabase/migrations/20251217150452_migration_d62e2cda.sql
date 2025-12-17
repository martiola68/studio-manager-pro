-- Tabella Eventi Agenda
CREATE TABLE IF NOT EXISTS eventi_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  id_cliente UUID REFERENCES clienti(id) ON DELETE SET NULL,
  titolo TEXT NOT NULL,
  descrizione TEXT,
  data_inizio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_fine TIMESTAMP WITH TIME ZONE NOT NULL,
  tutto_giorno BOOLEAN NOT NULL DEFAULT false,
  colore TEXT,
  luogo TEXT,
  in_sede BOOLEAN DEFAULT true,
  sala TEXT,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('Appuntamento', 'Riunione', 'Scadenza', 'Altro')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE eventi_agenda ENABLE ROW LEVEL SECURITY;

-- Policies per eventi (ogni utente vede solo i propri)
CREATE POLICY "Users can view their own eventi" ON eventi_agenda FOR SELECT USING (auth.uid() = id_utente);
CREATE POLICY "Users can insert their own eventi" ON eventi_agenda FOR INSERT WITH CHECK (auth.uid() = id_utente);
CREATE POLICY "Users can update their own eventi" ON eventi_agenda FOR UPDATE USING (auth.uid() = id_utente);
CREATE POLICY "Users can delete their own eventi" ON eventi_agenda FOR DELETE USING (auth.uid() = id_utente);
CREATE POLICY "Admin can view all eventi" ON eventi_agenda FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM utenti WHERE id = auth.uid() AND tipo_utente = 'Admin'
  )
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_eventi_utente ON eventi_agenda(id_utente);
CREATE INDEX IF NOT EXISTS idx_eventi_cliente ON eventi_agenda(id_cliente);
CREATE INDEX IF NOT EXISTS idx_eventi_data_inizio ON eventi_agenda(data_inizio);