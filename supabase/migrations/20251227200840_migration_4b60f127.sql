-- Fai lo stesso per tbconversazioni_utenti
DROP POLICY IF EXISTS "allow_insert_participants" ON tbconversazioni_utenti;

CREATE POLICY "allow_insert_participants" ON tbconversazioni_utenti
  FOR INSERT
  TO authenticated  -- ← DEVE essere authenticated, non public!
  WITH CHECK (utente_id = auth.uid());

-- Verifica
SELECT 
  'POLICY INSERT PARTECIPANTI CORRETTA' as status,
  policyname,
  cmd,
  roles,
  with_check
FROM pg_policies 
WHERE tablename = 'tbconversazioni_utenti' 
  AND cmd = 'INSERT';