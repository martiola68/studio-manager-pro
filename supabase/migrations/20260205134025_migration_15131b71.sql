-- Rimuovo il vecchio constraint
ALTER TABLE tbcomunicazioni DROP CONSTRAINT IF EXISTS tbcomunicazioni_tipo_check;

-- Aggiungo il nuovo constraint con 'interna' incluso
ALTER TABLE tbcomunicazioni 
ADD CONSTRAINT tbcomunicazioni_tipo_check 
CHECK (tipo IN ('newsletter', 'scadenze', 'singola', 'interna'));