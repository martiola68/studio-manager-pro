-- STEP 1: Aggiungo le 3 nuove colonne boolean
ALTER TABLE tbclienti 
ADD COLUMN settore_fiscale BOOLEAN DEFAULT false,
ADD COLUMN settore_lavoro BOOLEAN DEFAULT false,
ADD COLUMN settore_consulenza BOOLEAN DEFAULT false;

-- STEP 2: Migro i dati dalla vecchia colonna "settore" alle nuove colonne
-- "Fiscale" → settore_fiscale=true
UPDATE tbclienti 
SET settore_fiscale = true, 
    settore_lavoro = false, 
    settore_consulenza = false
WHERE settore = 'Fiscale';

-- "Lavoro" → settore_lavoro=true
UPDATE tbclienti 
SET settore_fiscale = false, 
    settore_lavoro = true, 
    settore_consulenza = false
WHERE settore = 'Lavoro';

-- "Fiscale & Lavoro" → settore_fiscale=true, settore_lavoro=true
UPDATE tbclienti 
SET settore_fiscale = true, 
    settore_lavoro = true, 
    settore_consulenza = false
WHERE settore = 'Fiscale & Lavoro' OR settore ILIKE '%fiscale%lavoro%';

-- "Consulenza" → settore_consulenza=true (se esistono)
UPDATE tbclienti 
SET settore_fiscale = false, 
    settore_lavoro = false, 
    settore_consulenza = true
WHERE settore ILIKE '%consulenza%';

-- STEP 3: Rimuovo la vecchia colonna "settore"
ALTER TABLE tbclienti DROP COLUMN settore;

-- STEP 4: Aggiungo commenti per documentazione
COMMENT ON COLUMN tbclienti.settore_fiscale IS 'Cliente appartiene al settore fiscale (mostra campi utente_fiscale, professionista_fiscale)';
COMMENT ON COLUMN tbclienti.settore_lavoro IS 'Cliente appartiene al settore lavoro/payroll (mostra campi utente_payroll, professionista_payroll)';
COMMENT ON COLUMN tbclienti.settore_consulenza IS 'Cliente appartiene al settore consulenza';