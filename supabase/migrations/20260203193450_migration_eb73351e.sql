-- STEP 4: Aggiornare RLS policies per tbcontatti
DROP POLICY IF EXISTS "Users can view contacts" ON tbcontatti;
DROP POLICY IF EXISTS "Users can insert contacts" ON tbcontatti;
DROP POLICY IF EXISTS "Users can update contacts" ON tbcontatti;
DROP POLICY IF EXISTS "Users can delete contacts" ON tbcontatti;

CREATE POLICY "Studio members can view contacts" ON tbcontatti
  FOR SELECT USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can insert contacts" ON tbcontatti
  FOR INSERT WITH CHECK (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can update contacts" ON tbcontatti
  FOR UPDATE USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can delete contacts" ON tbcontatti
  FOR DELETE USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );