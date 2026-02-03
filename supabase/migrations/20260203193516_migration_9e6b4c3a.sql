-- STEP 7: Aggiornare RLS policies per tutte le tabelle scadenze
DROP POLICY IF EXISTS "Users can view iva" ON tbscadiva;
DROP POLICY IF EXISTS "Users can insert iva" ON tbscadiva;
DROP POLICY IF EXISTS "Users can update iva" ON tbscadiva;
DROP POLICY IF EXISTS "Users can delete iva" ON tbscadiva;

CREATE POLICY "Studio members can view iva" ON tbscadiva
  FOR SELECT USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can insert iva" ON tbscadiva
  FOR INSERT WITH CHECK (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can update iva" ON tbscadiva
  FOR UPDATE USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can delete iva" ON tbscadiva
  FOR DELETE USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );