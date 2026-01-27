-- Rimuovo e ricreo i vincoli per essere sicuro che corrispondano ai nuovi valori
ALTER TABLE tbclienti DROP CONSTRAINT IF EXISTS tbclienti_tipo_cliente_check;
ALTER TABLE tbclienti ADD CONSTRAINT tbclienti_tipo_cliente_check CHECK (tipo_cliente IN ('Persona fisica', 'Altro'));

ALTER TABLE tbclienti DROP CONSTRAINT IF EXISTS tbclienti_tipologia_cliente_check;
ALTER TABLE tbclienti ADD CONSTRAINT tbclienti_tipologia_cliente_check CHECK (tipologia_cliente IN ('Interno', 'Esterno'));

ALTER TABLE tbclienti DROP CONSTRAINT IF EXISTS tbclienti_tipo_redditi_check;
ALTER TABLE tbclienti ADD CONSTRAINT tbclienti_tipo_redditi_check CHECK (tipo_redditi IN ('USC', 'USP', 'ENC', 'UPF', '730'));

ALTER TABLE tbclienti DROP CONSTRAINT IF EXISTS tbclienti_settore_check;
ALTER TABLE tbclienti ADD CONSTRAINT tbclienti_settore_check CHECK (settore IN ('Fiscale', 'Lavoro', 'Fiscale & Lavoro'));