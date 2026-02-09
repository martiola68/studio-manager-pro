-- Crea la tabella microsoft365_config
CREATE TABLE IF NOT EXISTS microsoft365_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id UUID NOT NULL REFERENCES tbstudio(id) ON DELETE CASCADE,
  client_id TEXT,
  tenant_id TEXT,
  client_secret TEXT,
  enabled BOOLEAN DEFAULT false,
  features JSONB DEFAULT '{"email": false, "calendar": false, "contacts": false, "teams": false}',
  connected_email TEXT,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_studio_config UNIQUE (studio_id)
);

-- Abilita RLS
ALTER TABLE microsoft365_config ENABLE ROW LEVEL SECURITY;

-- Policy per lettura (solo Admin o utenti dello stesso studio)
CREATE POLICY "Gli utenti possono leggere la config del proprio studio"
  ON microsoft365_config FOR SELECT
  USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti WHERE email = auth.email()
    )
  );

-- Policy per modifica (solo Admin dello studio)
CREATE POLICY "Solo gli admin possono modificare la config"
  ON microsoft365_config FOR ALL
  USING (
    studio_id IN (
      SELECT studio_id FROM tbutenti 
      WHERE email = auth.email() AND tipo_utente = 'Admin'
    )
  );