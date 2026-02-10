-- Aggiungo colonna per tracciare sync Microsoft Calendar
ALTER TABLE tbagenda 
ADD COLUMN IF NOT EXISTS outlook_synced BOOLEAN DEFAULT FALSE;

-- Aggiungo commento esplicativo
COMMENT ON COLUMN tbagenda.outlook_synced IS 'Flag che indica se l''evento è sincronizzato con Outlook Calendar';

-- Creo indice per query efficienti
CREATE INDEX IF NOT EXISTS idx_tbagenda_outlook_synced ON tbagenda(outlook_synced);
CREATE INDEX IF NOT EXISTS idx_tbagenda_microsoft_event_id ON tbagenda(microsoft_event_id) WHERE microsoft_event_id IS NOT NULL;