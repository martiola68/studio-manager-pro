-- FASE 1C: MODIFICA TABELLA tbscad770 - Aggiunta campo UtentePayroll
ALTER TABLE tbscad770 
ADD COLUMN IF NOT EXISTS utente_payroll_id UUID REFERENCES tbutenti(id);

-- Aggiungi commento per documentazione
COMMENT ON COLUMN tbscad770.utente_payroll_id IS 'Riferimento utente payroll (FK tbutenti)';