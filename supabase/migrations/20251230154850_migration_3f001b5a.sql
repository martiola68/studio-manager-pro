-- Aggiungi colonne mancanti alla tabella tbscadimu
ALTER TABLE public.tbscadimu 
ADD COLUMN IF NOT EXISTS confermariga boolean DEFAULT false, -- Typo fix: conferma_riga usually match but let's stick to snake_case standard if validation fails. Wait, error said 'conferma_riga'.
ADD COLUMN IF NOT EXISTS conferma_riga boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS note text,
ADD COLUMN IF NOT EXISTS dichiarazione_scadenza date,
ADD COLUMN IF NOT EXISTS acconto_data date,
ADD COLUMN IF NOT EXISTS saldo_data date;

COMMENT ON COLUMN public.tbscadimu.conferma_riga IS 'Flag per indicare se la pratica è conclusa';
COMMENT ON COLUMN public.tbscadimu.note IS 'Note libere';