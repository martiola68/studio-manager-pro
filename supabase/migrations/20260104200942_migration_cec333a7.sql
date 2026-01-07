-- Drop existing restrictive policies on tbconversazioni_utenti
DROP POLICY IF EXISTS "allow_insert_partecipanti" ON tbconversazioni_utenti;
DROP POLICY IF EXISTS "allow_select_partecipanti" ON tbconversazioni_utenti;
DROP POLICY IF EXISTS "allow_update_partecipanti" ON tbconversazioni_utenti;
DROP POLICY IF EXISTS "allow_delete_partecipanti" ON tbconversazioni_utenti;

-- INSERT: Allow authenticated users to add participants to conversations in their studio
CREATE POLICY "allow_insert_partecipanti" 
ON tbconversazioni_utenti 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM tbconversazioni c
    WHERE c.id = conversazione_id 
    AND c.studio_id IN (
      SELECT studio_id 
      FROM tbutenti 
      WHERE id = auth.uid()
    )
  )
);

COMMENT ON POLICY "allow_insert_partecipanti" ON tbconversazioni_utenti 
IS 'Allows authenticated users to add participants to conversations in their studio';

-- SELECT: Allow users to see participants of conversations in their studio
CREATE POLICY "allow_select_partecipanti" 
ON tbconversazioni_utenti 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM tbconversazioni c
    WHERE c.id = conversazione_id 
    AND c.studio_id IN (
      SELECT studio_id 
      FROM tbutenti 
      WHERE id = auth.uid()
    )
  )
);

COMMENT ON POLICY "allow_select_partecipanti" ON tbconversazioni_utenti 
IS 'Allows users to view participants of conversations in their studio';

-- UPDATE: Allow users to update participants in conversations of their studio
CREATE POLICY "allow_update_partecipanti" 
ON tbconversazioni_utenti 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM tbconversazioni c
    WHERE c.id = conversazione_id 
    AND c.studio_id IN (
      SELECT studio_id 
      FROM tbutenti 
      WHERE id = auth.uid()
    )
  )
);

COMMENT ON POLICY "allow_update_partecipanti" ON tbconversazioni_utenti 
IS 'Allows users to update participants of conversations in their studio';

-- DELETE: Allow users to remove participants from conversations of their studio
CREATE POLICY "allow_delete_partecipanti" 
ON tbconversazioni_utenti 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM tbconversazioni c
    WHERE c.id = conversazione_id 
    AND c.studio_id IN (
      SELECT studio_id 
      FROM tbutenti 
      WHERE id = auth.uid()
    )
  )
);

COMMENT ON POLICY "allow_delete_partecipanti" ON tbconversazioni_utenti 
IS 'Allows users to remove participants from conversations in their studio';