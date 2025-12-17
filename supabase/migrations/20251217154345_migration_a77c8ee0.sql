-- Tabella Scadenze
CREATE TABLE IF NOT EXISTS scadenze (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente UUID NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  tipo_scadenza TEXT NOT NULL CHECK (tipo_scadenza IN ('IVA', 'CCGG', 'CU', 'Fiscali', 'Bilanci', '770', 'LIPE', 'Esterometro', 'Proforma')),
  stato_scadenza TEXT NOT NULL CHECK (stato_scadenza IN ('InAttesa', 'InLavorazione', 'Completata', 'Annullata')),
  data_scadenza TIMESTAMPTZ NOT NULL,
  descrizione TEXT,
  conferma_riga BOOLEAN DEFAULT false,
  note TEXT,
  importo NUMERIC,
  data_invio TIMESTAMPTZ,
  data_deposito TIMESTAMPTZ,
  data_approvazione TIMESTAMPTZ,
  periodo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scadenze ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view scadenze
CREATE POLICY "Users can view scadenze" ON scadenze FOR SELECT USING (auth.uid() IS NOT NULL);
-- Policy: Users can insert scadenze
CREATE POLICY "Users can insert scadenze" ON scadenze FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Policy: Users can update scadenze
CREATE POLICY "Users can update scadenze" ON scadenze FOR UPDATE USING (auth.uid() IS NOT NULL);
-- Policy: Users can delete scadenze
CREATE POLICY "Users can delete scadenze" ON scadenze FOR DELETE USING (auth.uid() IS NOT NULL);