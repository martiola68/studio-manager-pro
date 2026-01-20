ALTER TABLE tbpromemoria 
ADD COLUMN IF NOT EXISTS titolo text;

ALTER TABLE tbpromemoria 
ALTER COLUMN tipo_promemoria_id DROP NOT NULL;

-- Aggiorno anche descrizione che non esiste, uso note
-- Ma per evitare confusione nel frontend che usa descrizione, aggiungo descrizione come alias di note o colonna nuova
-- Controllo se esiste già note... Si esiste.
-- Per semplicità aggiungo descrizione per matchare il frontend 1:1
ALTER TABLE tbpromemoria
ADD COLUMN IF NOT EXISTS descrizione text;