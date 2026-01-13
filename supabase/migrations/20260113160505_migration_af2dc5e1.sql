-- Aggiungo la colonna cliente_id alla tabella tbcontatti
ALTER TABLE tbcontatti 
ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES tbclienti(id) ON DELETE SET NULL;

-- Creo un indice per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_tbcontatti_cliente_id ON tbcontatti(cliente_id);

-- Commento sulla colonna per documentazione
COMMENT ON COLUMN tbcontatti.cliente_id IS 'FK alla società/cliente associato al contatto';