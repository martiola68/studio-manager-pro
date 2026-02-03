-- STEP 3: Aggiornare RLS policies per tbclienti
DROP POLICY IF EXISTS "Users can view clients" ON tbclienti;
DROP POLICY IF EXISTS "Users can insert clients" ON tbclienti;
DROP POLICY IF EXISTS "Users can update clients" ON tbclienti;
DROP POLICY IF EXISTS "Users can delete clients" ON tbclienti;

CREATE POLICY "Studio members can view clients" ON tbclienti
  FOR SELECT USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can insert clients" ON tbclienti
  FOR INSERT WITH CHECK (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can update clients" ON tbclienti
  FOR UPDATE USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can delete clients" ON tbclienti
  FOR DELETE USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );