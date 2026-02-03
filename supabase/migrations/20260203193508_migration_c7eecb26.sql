-- STEP 6: Aggiornare RLS policies per tbmessaggi
DROP POLICY IF EXISTS "Users can view messages" ON tbmessaggi;
DROP POLICY IF EXISTS "Users can insert messages" ON tbmessaggi;
DROP POLICY IF EXISTS "Users can update messages" ON tbmessaggi;
DROP POLICY IF EXISTS "Users can delete messages" ON tbmessaggi;

CREATE POLICY "Studio members can view messages" ON tbmessaggi
  FOR SELECT USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can insert messages" ON tbmessaggi
  FOR INSERT WITH CHECK (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can update messages" ON tbmessaggi
  FOR UPDATE USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );

CREATE POLICY "Studio members can delete messages" ON tbmessaggi
  FOR DELETE USING (
    studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid())
  );