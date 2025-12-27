-- SOLUZIONE DEFINITIVA: Policy che verifica esplicitamente che il creatore sia l'utente autenticato

-- 1. Drop policy esistente
DROP POLICY IF EXISTS "allow_insert_conversations" ON tbconversazioni;

-- 2. Crea policy corretta che verifica che chi crea sia l'utente loggato
CREATE POLICY "allow_insert_conversations" ON tbconversazioni
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND creato_da = auth.uid()
  AND studio_id IS NOT NULL
);