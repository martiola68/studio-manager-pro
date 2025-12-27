-- SOLUZIONE: Ricrea la policy INSERT con il ruolo corretto
DROP POLICY IF EXISTS "allow_insert_conversazioni" ON tbconversazioni;

CREATE POLICY "allow_insert_conversazioni" ON tbconversazioni
  FOR INSERT
  TO authenticated  -- ← CAMBIATO DA public A authenticated!
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND studio_id IS NOT NULL 
    AND creato_da = auth.uid()
  );

-- Verifica che sia stata creata correttamente
SELECT 
  'POLICY INSERT CORRETTA' as status,
  policyname,
  cmd,
  roles,
  with_check
FROM pg_policies 
WHERE tablename = 'tbconversazioni' 
  AND cmd = 'INSERT';