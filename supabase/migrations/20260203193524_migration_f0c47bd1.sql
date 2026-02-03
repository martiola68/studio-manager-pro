-- Continuare con altre tabelle scadenze
DROP POLICY IF EXISTS "Users can view fiscali" ON tbscadfiscali;
DROP POLICY IF EXISTS "Users can insert fiscali" ON tbscadfiscali;
DROP POLICY IF EXISTS "Users can update fiscali" ON tbscadfiscali;
DROP POLICY IF EXISTS "Users can delete fiscali" ON tbscadfiscali;

CREATE POLICY "Studio members can view fiscali" ON tbscadfiscali
  FOR SELECT USING (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));
CREATE POLICY "Studio members can insert fiscali" ON tbscadfiscali
  FOR INSERT WITH CHECK (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));
CREATE POLICY "Studio members can update fiscali" ON tbscadfiscali
  FOR UPDATE USING (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));
CREATE POLICY "Studio members can delete fiscali" ON tbscadfiscali
  FOR DELETE USING (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));

-- tbscadimu
DROP POLICY IF EXISTS "Users can view imu" ON tbscadimu;
DROP POLICY IF EXISTS "Users can insert imu" ON tbscadimu;
DROP POLICY IF EXISTS "Users can update imu" ON tbscadimu;
DROP POLICY IF EXISTS "Users can delete imu" ON tbscadimu;

CREATE POLICY "Studio members can view imu" ON tbscadimu
  FOR SELECT USING (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));
CREATE POLICY "Studio members can insert imu" ON tbscadimu
  FOR INSERT WITH CHECK (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));
CREATE POLICY "Studio members can update imu" ON tbscadimu
  FOR UPDATE USING (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));
CREATE POLICY "Studio members can delete imu" ON tbscadimu
  FOR DELETE USING (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));