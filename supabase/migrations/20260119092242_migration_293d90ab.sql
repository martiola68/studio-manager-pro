-- Creo una policy SELECT semplice e permissiva per gli utenti autenticati
-- Questa policy permette agli utenti di vedere le proprie conversazioni basandosi solo su utente_id
CREATE POLICY "allow_users_view_own_conversations" 
ON tbconversazioni_utenti 
FOR SELECT 
TO authenticated 
USING (utente_id = auth.uid());