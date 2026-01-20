-- FASE 1A: MODIFICA TABELLA tbclienti - Aggiunta nuovi campi
ALTER TABLE tbclienti 
ADD COLUMN IF NOT EXISTS tipologia_cliente TEXT CHECK (tipologia_cliente IN ('CL interno', 'CL esterno')),
ADD COLUMN IF NOT EXISTS utente_payroll_id UUID REFERENCES tbutenti(id),
ADD COLUMN IF NOT EXISTS professionista_payroll_id UUID REFERENCES tbutenti(id),
ADD COLUMN IF NOT EXISTS matricola_inps TEXT,
ADD COLUMN IF NOT EXISTS pat_inail TEXT,
ADD COLUMN IF NOT EXISTS codice_ditta_ce TEXT;

-- Aggiungi commenti per documentazione
COMMENT ON COLUMN tbclienti.tipologia_cliente IS 'Tipologia cliente: CL interno o CL esterno';
COMMENT ON COLUMN tbclienti.utente_payroll_id IS 'Riferimento utente payroll (FK tbutenti)';
COMMENT ON COLUMN tbclienti.professionista_payroll_id IS 'Riferimento professionista payroll (FK tbutenti)';
COMMENT ON COLUMN tbclienti.matricola_inps IS 'Matricola INPS del cliente';
COMMENT ON COLUMN tbclienti.pat_inail IS 'PAT INAIL del cliente';
COMMENT ON COLUMN tbclienti.codice_ditta_ce IS 'Codice Ditta CE del cliente';