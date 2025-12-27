-- SOLUZIONE: Policy RLS che verifica tramite JOIN con tbutenti
-- Invece di controllare creato_da = auth.uid() (che fallisce perché creato_da è tbutenti.id)
-- Controlliamo che auth.uid() corrisponda a un utente nella tabella tbutenti

DROP POLICY IF EXISTS "allow_insert_conversations" ON tbconversazioni;

CREATE POLICY "allow_insert_conversations" ON tbconversazioni
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND studio_id IS NOT NULL
  AND creato_da IN (
    SELECT id FROM tbutenti WHERE id = auth.uid()
  )
);