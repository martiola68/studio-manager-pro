-- Drop policy esistenti problematiche
DROP POLICY IF EXISTS "Gli utenti possono leggere la config del proprio studio" ON microsoft365_config;
DROP POLICY IF EXISTS "Solo gli admin possono modificare la config" ON microsoft365_config;
DROP POLICY IF EXISTS "Admin can manage Microsoft 365 config" ON microsoft365_config;

-- Policy corrette con auth.uid()
CREATE POLICY "Gli utenti possono leggere la config del proprio studio"
ON microsoft365_config
FOR SELECT
USING (
  studio_id IN (
    SELECT studio_id 
    FROM tbutenti 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Solo gli admin possono inserire/aggiornare la config"
ON microsoft365_config
FOR ALL
USING (
  studio_id IN (
    SELECT studio_id 
    FROM tbutenti 
    WHERE id = auth.uid() AND tipo_utente = 'Admin'
  )
)
WITH CHECK (
  studio_id IN (
    SELECT studio_id 
    FROM tbutenti 
    WHERE id = auth.uid() AND tipo_utente = 'Admin'
  )
);