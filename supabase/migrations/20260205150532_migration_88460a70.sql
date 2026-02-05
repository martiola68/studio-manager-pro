-- Add recurring event fields to tbagenda table
ALTER TABLE tbagenda
ADD COLUMN IF NOT EXISTS ricorrente boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS frequenza_giorni integer,
ADD COLUMN IF NOT EXISTS durata_giorni integer;

-- Add comment for clarity
COMMENT ON COLUMN tbagenda.ricorrente IS 'Indica se l''evento è ricorrente';
COMMENT ON COLUMN tbagenda.frequenza_giorni IS 'Numero di giorni tra un evento e il successivo (es. 7 = settimanale)';
COMMENT ON COLUMN tbagenda.durata_giorni IS 'Durata complessiva della ricorrenza in giorni dalla data inizio';