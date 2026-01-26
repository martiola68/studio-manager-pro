ALTER TABLE tbclienti DROP CONSTRAINT IF EXISTS tbclienti_tipo_cliente_check;
ALTER TABLE tbclienti ADD CONSTRAINT tbclienti_tipo_cliente_check 
CHECK (tipo_cliente IN ('Persona Fisica', 'Persona Giuridica', 'PERSONA_FISICA', 'PERSONA_GIURIDICA'));