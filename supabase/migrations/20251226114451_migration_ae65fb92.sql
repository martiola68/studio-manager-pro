-- Creazione tabella master per i tipi di scadenze (con nome corretto tbstudio)
CREATE TABLE IF NOT EXISTS tbtipi_scadenze (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  descrizione TEXT,
  data_scadenza DATE NOT NULL,
  tipo_scadenza TEXT NOT NULL CHECK (tipo_scadenza IN ('iva', 'fiscale', 'bilancio', '770', 'lipe', 'esterometro', 'ccgg', 'cu', 'proforma', 'antiriciclaggio')),
  ricorrente BOOLEAN DEFAULT false,
  giorni_preavviso_1 INTEGER DEFAULT 7,
  giorni_preavviso_2 INTEGER DEFAULT 15,
  attivo BOOLEAN DEFAULT true,
  studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_tbtipi_scadenze_data ON tbtipi_scadenze(data_scadenza);
CREATE INDEX IF NOT EXISTS idx_tbtipi_scadenze_tipo ON tbtipi_scadenze(tipo_scadenza);
CREATE INDEX IF NOT EXISTS idx_tbtipi_scadenze_studio ON tbtipi_scadenze(studio_id);
CREATE INDEX IF NOT EXISTS idx_tbtipi_scadenze_attivo ON tbtipi_scadenze(attivo);

-- RLS Policies
ALTER TABLE tbtipi_scadenze ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their studio's tipi scadenze" 
ON tbtipi_scadenze FOR SELECT 
USING (
  studio_id IN (
    SELECT studio_id FROM tbutenti WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert tipi scadenze for their studio" 
ON tbtipi_scadenze FOR INSERT 
WITH CHECK (
  studio_id IN (
    SELECT studio_id FROM tbutenti WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their studio's tipi scadenze" 
ON tbtipi_scadenze FOR UPDATE 
USING (
  studio_id IN (
    SELECT studio_id FROM tbutenti WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete their studio's tipi scadenze" 
ON tbtipi_scadenze FOR DELETE 
USING (
  studio_id IN (
    SELECT studio_id FROM tbutenti WHERE id = auth.uid()
  )
);