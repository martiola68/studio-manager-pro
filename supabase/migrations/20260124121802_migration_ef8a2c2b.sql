-- Creo tabella per tracciare gli invii delle alert email
CREATE TABLE IF NOT EXISTS tbtipi_scadenze_alert (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_scadenza_id UUID NOT NULL REFERENCES tbtipi_scadenze(id) ON DELETE CASCADE,
  anno_invio INTEGER NOT NULL,
  data_invio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  utente_invio_id UUID REFERENCES tbutenti(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indice per velocizzare le query
CREATE INDEX IF NOT EXISTS idx_alert_tipo_anno ON tbtipi_scadenze_alert(tipo_scadenza_id, anno_invio);

-- RLS policies
ALTER TABLE tbtipi_scadenze_alert ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alert logs" ON tbtipi_scadenze_alert FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert alert logs" ON tbtipi_scadenze_alert FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE tbtipi_scadenze_alert IS 'Traccia gli invii delle email di alert per i tipi di scadenza';
COMMENT ON COLUMN tbtipi_scadenze_alert.anno_invio IS 'Anno in cui è stata inviata la alert (per reset annuale)';