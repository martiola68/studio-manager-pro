-- Step 1: Rimuovo i vecchi constraints
ALTER TABLE tbclienti DROP CONSTRAINT IF EXISTS tbclienti_tipo_cliente_check;
ALTER TABLE tbclienti DROP CONSTRAINT IF EXISTS tbclienti_tipologia_cliente_check;
ALTER TABLE tbclienti DROP CONSTRAINT IF EXISTS tbclienti_tipo_redditi_check;

-- Step 2: Aggiungo i nuovi constraints con i valori richiesti
ALTER TABLE tbclienti ADD CONSTRAINT tbclienti_tipo_cliente_check 
  CHECK (tipo_cliente IN ('Persona fisica', 'Altro'));

ALTER TABLE tbclienti ADD CONSTRAINT tbclienti_tipologia_cliente_check 
  CHECK (tipologia_cliente IN ('Interno', 'Esterno'));

ALTER TABLE tbclienti ADD CONSTRAINT tbclienti_tipo_redditi_check 
  CHECK (tipo_redditi IN ('USC', 'USP', 'ENC', 'UPF', '730'));