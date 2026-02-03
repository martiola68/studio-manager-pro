-- Step 2: Aggiornare RLS Policies per Multi-Tenancy

-- Policy per tbclienti
DROP POLICY IF EXISTS "Users can view clients" ON tbclienti;
DROP POLICY IF EXISTS "Users can insert clients" ON tbclienti;
DROP POLICY IF EXISTS "Users can update clients" ON tbclienti;
DROP POLICY IF EXISTS "Users can delete clients" ON tbclienti;

CREATE POLICY "Users can view their studio clients" ON tbclienti
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert studio clients" ON tbclienti
  FOR INSERT WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update studio clients" ON tbclienti
  FOR UPDATE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete studio clients" ON tbclienti
  FOR DELETE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

-- Policy per tbcontatti
DROP POLICY IF EXISTS "Users can view contacts" ON tbcontatti;
DROP POLICY IF EXISTS "Users can insert contacts" ON tbcontatti;
DROP POLICY IF EXISTS "Users can update contacts" ON tbcontatti;
DROP POLICY IF EXISTS "Users can delete contacts" ON tbcontatti;

CREATE POLICY "Users can view their studio contacts" ON tbcontatti
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert studio contacts" ON tbcontatti
  FOR INSERT WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update studio contacts" ON tbcontatti
  FOR UPDATE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete studio contacts" ON tbcontatti
  FOR DELETE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

-- Policy per tbprestazioni
DROP POLICY IF EXISTS "Users can view services" ON tbprestazioni;
DROP POLICY IF EXISTS "Users can insert services" ON tbprestazioni;
DROP POLICY IF EXISTS "Users can update services" ON tbprestazioni;
DROP POLICY IF EXISTS "Users can delete services" ON tbprestazioni;

CREATE POLICY "Users can view their studio services" ON tbprestazioni
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert studio services" ON tbprestazioni
  FOR INSERT WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update studio services" ON tbprestazioni
  FOR UPDATE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete studio services" ON tbprestazioni
  FOR DELETE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

-- Policy per tbroperatore
DROP POLICY IF EXISTS "Users can view roles" ON tbroperatore;
DROP POLICY IF EXISTS "Users can insert roles" ON tbroperatore;
DROP POLICY IF EXISTS "Users can update roles" ON tbroperatore;
DROP POLICY IF EXISTS "Users can delete roles" ON tbroperatore;

CREATE POLICY "Users can view their studio roles" ON tbroperatore
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert studio roles" ON tbroperatore
  FOR INSERT WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update studio roles" ON tbroperatore
  FOR UPDATE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete studio roles" ON tbroperatore
  FOR DELETE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

-- Policy per tbtipopromemoria
DROP POLICY IF EXISTS "Users can view reminder types" ON tbtipopromemoria;
DROP POLICY IF EXISTS "Users can insert reminder types" ON tbtipopromemoria;
DROP POLICY IF EXISTS "Users can update reminder types" ON tbtipopromemoria;
DROP POLICY IF EXISTS "Users can delete reminder types" ON tbtipopromemoria;

CREATE POLICY "Users can view their studio reminder types" ON tbtipopromemoria
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert studio reminder types" ON tbtipopromemoria
  FOR INSERT WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update studio reminder types" ON tbtipopromemoria
  FOR UPDATE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete studio reminder types" ON tbtipopromemoria
  FOR DELETE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

-- Policy per tbcomunicazioni
DROP POLICY IF EXISTS "Users can view communications" ON tbcomunicazioni;
DROP POLICY IF EXISTS "Users can insert communications" ON tbcomunicazioni;
DROP POLICY IF EXISTS "Users can update communications" ON tbcomunicazioni;
DROP POLICY IF EXISTS "Users can delete communications" ON tbcomunicazioni;

CREATE POLICY "Users can view their studio communications" ON tbcomunicazioni
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert studio communications" ON tbcomunicazioni
  FOR INSERT WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update studio communications" ON tbcomunicazioni
  FOR UPDATE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete studio communications" ON tbcomunicazioni
  FOR DELETE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

-- Policy per tbcredenziali_accesso
DROP POLICY IF EXISTS "Users can view credentials" ON tbcredenziali_accesso;
DROP POLICY IF EXISTS "Users can insert credentials" ON tbcredenziali_accesso;
DROP POLICY IF EXISTS "Users can update credentials" ON tbcredenziali_accesso;
DROP POLICY IF EXISTS "Users can delete credentials" ON tbcredenziali_accesso;

CREATE POLICY "Users can view their studio credentials" ON tbcredenziali_accesso
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert studio credentials" ON tbcredenziali_accesso
  FOR INSERT WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update studio credentials" ON tbcredenziali_accesso
  FOR UPDATE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete studio credentials" ON tbcredenziali_accesso
  FOR DELETE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

-- Policy per tbreferimenti_valori
DROP POLICY IF EXISTS "Users can view reference values" ON tbreferimenti_valori;
DROP POLICY IF EXISTS "Users can insert reference values" ON tbreferimenti_valori;
DROP POLICY IF EXISTS "Users can update reference values" ON tbreferimenti_valori;
DROP POLICY IF EXISTS "Users can delete reference values" ON tbreferimenti_valori;

CREATE POLICY "Users can view their studio reference values" ON tbreferimenti_valori
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert studio reference values" ON tbreferimenti_valori
  FOR INSERT WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update studio reference values" ON tbreferimenti_valori
  FOR UPDATE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete studio reference values" ON tbreferimenti_valori
  FOR DELETE USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE id = auth.uid()
    )
  );