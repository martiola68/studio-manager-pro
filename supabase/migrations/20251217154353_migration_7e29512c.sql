-- Tabella Eventi Agenda
CREATE TABLE IF NOT EXISTS eventi_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utente UUID NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
  id_cliente UUID REFERENCES clienti(id) ON DELETE SET NULL,
  titolo TEXT NOT NULL,
  descrizione TEXT,
  data_inizio TIMESTAMPTZ NOT NULL,
  data_fine TIMESTAMPTZ NOT NULL,
  tutto_giorno BOOLEAN DEFAULT false,
  colore TEXT,
  luogo TEXT,
  in_sede BOOLEAN DEFAULT false,
  sala TEXT,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('Appuntamento', 'Riunione', 'Scadenza', 'Altro')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE eventi_agenda ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view eventi
CREATE POLICY "Users can view eventi" ON eventi_agenda FOR SELECT USING (auth.uid() IS NOT NULL);
-- Policy: Users can insert eventi
CREATE POLICY "Users can insert eventi" ON eventi_agenda FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Policy: Users can update eventi
CREATE POLICY "Users can update eventi" ON eventi_agenda FOR UPDATE USING (auth.uid() IS NOT NULL);
-- Policy: Users can delete eventi
CREATE POLICY "Users can delete eventi" ON eventi_agenda FOR DELETE USING (auth.uid() IS NOT NULL);