-- Elimina la policy vecchia/complessa con il subquery
DROP POLICY IF EXISTS "allow_insert_conversations" ON tbconversazioni;

-- Verifica che rimanga solo la policy corretta
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'tbconversazioni' 
  AND cmd = 'INSERT';