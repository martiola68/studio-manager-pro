-- STEP 5: Aggiornare RLS policies per tbpromemoria
DROP POLICY IF EXISTS "Users can view promemoria" ON tbpromemoria;
DROP POLICY IF EXISTS "Users can insert promemoria" ON tbpromemoria;
DROP POLICY IF EXISTS "Users can update promemoria" ON tbpromemoria;
DROP POLICY IF EXISTS "Users can delete promemoria" ON tbpromemoria;

CREATE POLICY "Studio members can view promemoria" ON tbpromemoria
  FOR SELECT USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can insert promemoria" ON tbpromemoria
  FOR INSERT WITH CHECK (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can update promemoria" ON tbpromemoria
  FOR UPDATE USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can delete promemoria" ON tbpromemoria
  FOR DELETE USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );