-- Tabella per i tipi di promemoria (gestita in impostazioni)
CREATE TABLE IF NOT EXISTS tbtipopromemoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descrizione TEXT,
  colore TEXT DEFAULT '#3B82F6',
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tbtipopromemoria ENABLE ROW LEVEL SECURITY;

-- RLS Policies per tbtipopromemoria
CREATE POLICY "Users can view tipo promemoria" ON tbtipopromemoria FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can insert tipo promemoria" ON tbtipopromemoria FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can update tipo promemoria" ON tbtipopromemoria FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can delete tipo promemoria" ON tbtipopromemoria FOR DELETE USING (auth.uid() IS NOT NULL);

-- Tabella promemoria
CREATE TABLE IF NOT EXISTS tbpromemoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operatore_id UUID NOT NULL REFERENCES tbutenti(id) ON DELETE CASCADE,
  tipo_promemoria_id UUID NOT NULL REFERENCES tbtipopromemoria(id) ON DELETE RESTRICT,
  data_inserimento DATE NOT NULL DEFAULT CURRENT_DATE,
  giorni_scadenza INTEGER NOT NULL DEFAULT 30,
  data_scadenza DATE NOT NULL,
  working_progress TEXT NOT NULL DEFAULT 'In lavorazione' CHECK (working_progress IN ('In lavorazione', 'Concluso')),
  da_fatturare BOOLEAN NOT NULL DEFAULT false,
  fatturato BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tbpromemoria ENABLE ROW LEVEL SECURITY;

-- RLS Policies per tbpromemoria (ogni utente vede SOLO i suoi)
CREATE POLICY "Users can view their own promemoria" ON tbpromemoria FOR SELECT USING (auth.uid() = operatore_id);
CREATE POLICY "Users can insert their own promemoria" ON tbpromemoria FOR INSERT WITH CHECK (auth.uid() = operatore_id);
CREATE POLICY "Users can update their own promemoria" ON tbpromemoria FOR UPDATE USING (auth.uid() = operatore_id);
CREATE POLICY "Users can delete their own promemoria" ON tbpromemoria FOR DELETE USING (auth.uid() = operatore_id);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tbtipopromemoria_updated_at BEFORE UPDATE ON tbtipopromemoria
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tbpromemoria_updated_at BEFORE UPDATE ON tbpromemoria
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserisco alcuni tipi di default
INSERT INTO tbtipopromemoria (nome, descrizione, colore) VALUES
  ('Appuntamento', 'Appuntamento con cliente o fornitore', '#3B82F6'),
  ('Scadenza Documento', 'Scadenza per consegna documento', '#EF4444'),
  ('Revisione', 'Revisione pratica o documento', '#F59E0B'),
  ('Chiamata', 'Promemoria per chiamata telefonica', '#10B981'),
  ('Email', 'Promemoria per invio email', '#8B5CF6'),
  ('Altro', 'Altro tipo di promemoria', '#6B7280')
ON CONFLICT (nome) DO NOTHING;