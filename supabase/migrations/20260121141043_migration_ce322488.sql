ALTER TABLE tbpromemoria DROP CONSTRAINT IF EXISTS tbpromemoria_working_progress_check;

ALTER TABLE tbpromemoria ADD CONSTRAINT tbpromemoria_working_progress_check 
CHECK (working_progress IN ('Aperto', 'In lavorazione', 'Completato', 'Presa visione', 'Richiesta confronto', 'Annullata'));