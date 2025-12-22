-- Drop vecchio constraint e ricrea con il nuovo valore "CL"
ALTER TABLE tbscadlipe DROP CONSTRAINT IF EXISTS tbscadlipe_tipo_liq_check;

ALTER TABLE tbscadlipe 
ADD CONSTRAINT tbscadlipe_tipo_liq_check 
CHECK (tipo_liq IN ('M', 'T', 'CL'));