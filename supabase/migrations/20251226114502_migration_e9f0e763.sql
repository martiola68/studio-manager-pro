-- Aggiungo foreign key a tutte le tabelle scadenzari

ALTER TABLE tbscadiva ADD COLUMN IF NOT EXISTS tipo_scadenza_id UUID REFERENCES tbtipi_scadenze(id) ON DELETE SET NULL;
ALTER TABLE tbscadfiscali ADD COLUMN IF NOT EXISTS tipo_scadenza_id UUID REFERENCES tbtipi_scadenze(id) ON DELETE SET NULL;
ALTER TABLE tbscadbilanci ADD COLUMN IF NOT EXISTS tipo_scadenza_id UUID REFERENCES tbtipi_scadenze(id) ON DELETE SET NULL;
ALTER TABLE tbscad770 ADD COLUMN IF NOT EXISTS tipo_scadenza_id UUID REFERENCES tbtipi_scadenze(id) ON DELETE SET NULL;
ALTER TABLE tbscadlipe ADD COLUMN IF NOT EXISTS tipo_scadenza_id UUID REFERENCES tbtipi_scadenze(id) ON DELETE SET NULL;
ALTER TABLE tbscadestero ADD COLUMN IF NOT EXISTS tipo_scadenza_id UUID REFERENCES tbtipi_scadenze(id) ON DELETE SET NULL;
ALTER TABLE tbscadccgg ADD COLUMN IF NOT EXISTS tipo_scadenza_id UUID REFERENCES tbtipi_scadenze(id) ON DELETE SET NULL;
ALTER TABLE tbscadcu ADD COLUMN IF NOT EXISTS tipo_scadenza_id UUID REFERENCES tbtipi_scadenze(id) ON DELETE SET NULL;
ALTER TABLE tbscadproforma ADD COLUMN IF NOT EXISTS tipo_scadenza_id UUID REFERENCES tbtipi_scadenze(id) ON DELETE SET NULL;
ALTER TABLE tbscadantiric ADD COLUMN IF NOT EXISTS tipo_scadenza_id UUID REFERENCES tbtipi_scadenze(id) ON DELETE SET NULL;

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_tbscadiva_tipo_scadenza ON tbscadiva(tipo_scadenza_id);
CREATE INDEX IF NOT EXISTS idx_tbscadfiscali_tipo_scadenza ON tbscadfiscali(tipo_scadenza_id);
CREATE INDEX IF NOT EXISTS idx_tbscadbilanci_tipo_scadenza ON tbscadbilanci(tipo_scadenza_id);
CREATE INDEX IF NOT EXISTS idx_tbscad770_tipo_scadenza ON tbscad770(tipo_scadenza_id);
CREATE INDEX IF NOT EXISTS idx_tbscadlipe_tipo_scadenza ON tbscadlipe(tipo_scadenza_id);
CREATE INDEX IF NOT EXISTS idx_tbscadestero_tipo_scadenza ON tbscadestero(tipo_scadenza_id);
CREATE INDEX IF NOT EXISTS idx_tbscadccgg_tipo_scadenza ON tbscadccgg(tipo_scadenza_id);
CREATE INDEX IF NOT EXISTS idx_tbscadcu_tipo_scadenza ON tbscadcu(tipo_scadenza_id);
CREATE INDEX IF NOT EXISTS idx_tbscadproforma_tipo_scadenza ON tbscadproforma(tipo_scadenza_id);
CREATE INDEX IF NOT EXISTS idx_tbscadantiric_tipo_scadenza ON tbscadantiric(tipo_scadenza_id);