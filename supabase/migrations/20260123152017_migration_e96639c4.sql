-- Modifica tabella tbcontatti: aggiungo i nuovi campi
ALTER TABLE tbcontatti 
ADD COLUMN altro_telefono TEXT,
ADD COLUMN contatto_principale TEXT,
ADD COLUMN pec TEXT,
ADD COLUMN email_secondaria TEXT,
ADD COLUMN email_altro TEXT;

-- Elimino il campo cliente_id
ALTER TABLE tbcontatti 
DROP COLUMN IF EXISTS cliente_id;