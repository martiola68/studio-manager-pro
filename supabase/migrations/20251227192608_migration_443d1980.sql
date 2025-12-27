-- RIPRISTINA le policy RLS semplici ora che gli UUID sono sincronizzati

-- Policy per INSERT su tbconversazioni
DROP POLICY IF EXISTS "allow_insert_conversazioni" ON tbconversazioni;
CREATE POLICY "allow_insert_conversazioni" ON tbconversazioni
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND studio_id IS NOT NULL
    AND creato_da = auth.uid()  -- Ora funziona perché tbutenti.id = auth.uid()
  );

-- Policy per INSERT su tbconversazioni_utenti  
DROP POLICY IF EXISTS "allow_insert_partecipanti" ON tbconversazioni_utenti;
CREATE POLICY "allow_insert_partecipanti" ON tbconversazioni_utenti
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND utente_id = auth.uid()  -- Ora funziona perché tbutenti.id = auth.uid()
  );

COMMENT ON POLICY "allow_insert_conversazioni" ON tbconversazioni IS 'Allow authenticated users to create conversations where they are the creator';
COMMENT ON POLICY "allow_insert_partecipanti" ON tbconversazioni_utenti IS 'Allow authenticated users to add themselves as participants';