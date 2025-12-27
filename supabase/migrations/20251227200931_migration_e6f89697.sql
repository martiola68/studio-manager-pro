-- Elimina la policy vecchia con ruolo public
DROP POLICY IF EXISTS "allow_insert_partecipanti" ON tbconversazioni_utenti;

-- Verifica che rimanga solo quella corretta
SELECT 
  'POLICY INSERT PARTECIPANTI FINALE' as status,
  policyname,
  cmd,
  roles,
  with_check
FROM pg_policies 
WHERE tablename = 'tbconversazioni_utenti' 
  AND cmd = 'INSERT';