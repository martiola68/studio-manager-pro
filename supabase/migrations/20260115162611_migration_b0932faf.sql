-- 1. Rimuovo TUTTI i constraint problematici
ALTER TABLE tbclienti DROP CONSTRAINT IF EXISTS tbclienti_tipo_cliente_check;

-- 2. Correggo i dati esistenti (ora senza constraint che bloccano)
UPDATE tbclienti 
SET tipo_cliente = 'PERSONA_FISICA' 
WHERE tipo_cliente NOT IN ('PERSONA_FISICA', 'PERSONA_GIURIDICA') OR tipo_cliente IS NULL;

-- 3. Applico il nuovo constraint CORRETTO
ALTER TABLE tbclienti ADD CONSTRAINT tbclienti_tipo_cliente_check 
CHECK (tipo_cliente IN ('PERSONA_FISICA', 'PERSONA_GIURIDICA'));

-- 4. Aggiungo colonna settore (se non esiste)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbclienti' AND column_name = 'settore') THEN
        ALTER TABLE tbclienti ADD COLUMN settore TEXT;
        ALTER TABLE tbclienti ADD CONSTRAINT tbclienti_settore_check CHECK (settore IN ('Fiscale', 'Lavoro'));
    END IF;
END $$;

-- 5. Rimuovo colonne percorsi (se esistono)
ALTER TABLE tbclienti DROP COLUMN IF EXISTS percorso_bilanci;
ALTER TABLE tbclienti DROP COLUMN IF EXISTS percorso_fiscali;
ALTER TABLE tbclienti DROP COLUMN IF EXISTS percorso_generale;