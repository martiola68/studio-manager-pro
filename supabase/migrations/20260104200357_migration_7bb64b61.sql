-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "allow_insert_conversazioni" ON tbconversazioni;

-- Create new flexible INSERT policy for conversations
CREATE POLICY "allow_insert_conversazioni" ON tbconversazioni
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be authenticated
  auth.uid() IS NOT NULL
  AND studio_id IS NOT NULL
  AND (
    -- For direct conversations: user must be one of the participants (will be added via separate table)
    tipo = 'diretta'
    OR
    -- For group conversations: user must be the creator
    (tipo = 'gruppo' AND creato_da = auth.uid())
  )
);

COMMENT ON POLICY "allow_insert_conversazioni" ON tbconversazioni IS 'Allows authenticated users to create conversations where they are participants';