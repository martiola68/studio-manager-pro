-- 1. Creo la nuova tabella tbcassettifiscali
CREATE TABLE IF NOT EXISTS tbcassettifiscali (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nominativo TEXT,
  username TEXT,
  password1 TEXT,
  pin TEXT,
  attiva1 BOOLEAN DEFAULT false,
  password2 TEXT,
  attiva2 BOOLEAN DEFAULT false,
  password_iniziale TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Abilito RLS sulla nuova tabella
ALTER TABLE tbcassettifiscali ENABLE ROW LEVEL SECURITY;

-- 3. Creo policy per permettere l'accesso agli utenti autenticati
CREATE POLICY "Utenti autenticati possono visualizzare cassetti fiscali" 
ON tbcassettifiscali FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Utenti autenticati possono inserire cassetti fiscali" 
ON tbcassettifiscali FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Utenti autenticati possono aggiornare cassetti fiscali" 
ON tbcassettifiscali FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Utenti autenticati possono eliminare cassetti fiscali" 
ON tbcassettifiscali FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- 4. Elimino i campi dalla tabella tbcontatti
ALTER TABLE tbcontatti 
DROP COLUMN IF EXISTS utente,
DROP COLUMN IF EXISTS password,
DROP COLUMN IF EXISTS pin;