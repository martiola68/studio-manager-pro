-- 1. Creo la funzione sicura che bypassa l'RLS per controllare i permessi
CREATE OR REPLACE FUNCTION public.is_chat_participant(_conversazione_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM tbconversazioni_utenti
    WHERE conversazione_id = _conversazione_id
    AND utente_id = auth.uid()
  );
END;
$$;

-- 2. Correggo le policy usando la nuova funzione

-- Tbconversazioni
DROP POLICY IF EXISTS "Users can view their conversations" ON tbconversazioni;
CREATE POLICY "Users can view their conversations" ON tbconversazioni
FOR SELECT USING (
  is_chat_participant(id)
);

-- Tbconversazioni_utenti (La causa principale dell'errore)
DROP POLICY IF EXISTS "Users can view conversation participants" ON tbconversazioni_utenti;
CREATE POLICY "Users can view conversation participants" ON tbconversazioni_utenti
FOR SELECT USING (
  is_chat_participant(conversazione_id)
);

-- Tbmessaggi (Per coerenza e performance)
DROP POLICY IF EXISTS "Users can view messages of their conversations" ON tbmessaggi;
CREATE POLICY "Users can view messages of their conversations" ON tbmessaggi
FOR SELECT USING (
  is_chat_participant(conversazione_id)
);