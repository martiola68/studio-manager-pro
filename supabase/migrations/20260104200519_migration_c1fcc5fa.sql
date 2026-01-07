-- Drop problematic policies that reference non-existent table
DROP POLICY IF EXISTS "allow_select_conversazioni" ON tbconversazioni;
DROP POLICY IF EXISTS "allow_update_conversazioni" ON tbconversazioni;

-- Create simplified RLS policies for tbconversazioni
-- These policies allow authenticated users to work with conversations in their studio

-- SELECT: Users can view conversations in their studio
CREATE POLICY "Users can view conversations in their studio"
ON tbconversazioni
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND studio_id IN (
    SELECT studio_id 
    FROM tbutenti 
    WHERE id = auth.uid()
  )
);

-- INSERT: Users can create conversations in their studio
CREATE POLICY "Users can create conversations in their studio"
ON tbconversazioni
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND studio_id IN (
    SELECT studio_id 
    FROM tbutenti 
    WHERE id = auth.uid()
  )
);

-- UPDATE: Users can update conversations in their studio
CREATE POLICY "Users can update conversations in their studio"
ON tbconversazioni
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND studio_id IN (
    SELECT studio_id 
    FROM tbutenti 
    WHERE id = auth.uid()
  )
);

-- DELETE: Only conversation creators can delete
CREATE POLICY "Users can delete their own conversations"
ON tbconversazioni
FOR DELETE
TO authenticated
USING (
  auth.uid() = creato_da
);

COMMENT ON POLICY "Users can view conversations in their studio" ON tbconversazioni 
IS 'Allows users to view all conversations within their studio';

COMMENT ON POLICY "Users can create conversations in their studio" ON tbconversazioni 
IS 'Allows users to create conversations within their studio';

COMMENT ON POLICY "Users can update conversations in their studio" ON tbconversazioni 
IS 'Allows users to update conversations within their studio';

COMMENT ON POLICY "Users can delete their own conversations" ON tbconversazioni 
IS 'Allows users to delete only conversations they created';