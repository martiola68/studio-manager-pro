-- Tabella Scadenze
CREATE TABLE IF NOT EXISTS scadenze (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente UUID NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  tipo_scadenza TEXT NOT NULL CHECK (tipo_scadenza IN ('IVA', 'CCGG', 'CU', 'Fiscali', 'Bilanci', '770', 'LIPE', 'Esterometro', 'Proforma')),
  stato_scadenza TEXT NOT NULL DEFAULT 'InAttesa' CHECK (stato_scadenza IN ('InAttesa', 'InLavorazione', 'Completata', 'Annullata')),
  data_scadenza DATE NOT NULL,
  descrizione TEXT,
  conferma_riga BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  -- Campi specifici opzionali
  importo NUMERIC(10,2),
  data_invio DATE,
  data_deposito DATE,
  data_approvazione DATE,
  periodo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scadenze ENABLE ROW LEVEL SECURITY;

-- Policies per scadenze
CREATE POLICY "Users can view all scadenze" ON scadenze FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert scadenze" ON scadenze FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update scadenze" ON scadenze FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete scadenze" ON scadenze FOR DELETE USING (auth.uid() IS NOT NULL);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_scadenze_cliente ON scadenze(id_cliente);
CREATE INDEX IF NOT EXISTS idx_scadenze_tipo ON scadenze(tipo_scadenza);
CREATE INDEX IF NOT EXISTS idx_scadenze_stato ON scadenze(stato_scadenza);
CREATE INDEX IF NOT EXISTS idx_scadenze_data ON scadenze(data_scadenza);
CREATE INDEX IF NOT EXISTS idx_scadenze_conferma ON scadenze(conferma_riga);