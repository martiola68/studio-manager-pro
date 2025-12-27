-- Aggiorna anche la policy per tbconversazioni_utenti
DROP POLICY IF EXISTS "allow_insert_participants" ON tbconversazioni_utenti;

CREATE POLICY "allow_insert_participants" ON tbconversazioni_utenti
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND utente_id IN (
    SELECT id FROM tbutenti WHERE id = auth.uid()
  )
);