-- Tabella per configurazione Microsoft 365 per studio
CREATE TABLE IF NOT EXISTS microsoft365_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id UUID NOT NULL REFERENCES tbstudi(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  client_secret TEXT NOT NULL, -- Criptato
  enabled BOOLEAN DEFAULT false,
  features JSONB DEFAULT '{"email": false, "calendar": false, "contacts": false, "teams": false}'::jsonb,
  connected_email TEXT,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(studio_id)
);

-- Indice per ricerca veloce per studio
CREATE INDEX IF NOT EXISTS idx_microsoft365_config_studio ON microsoft365_config(studio_id);

-- RLS Policies
ALTER TABLE microsoft365_config ENABLE ROW LEVEL SECURITY;

-- Policy: Solo admin dello studio può vedere/modificare la configurazione
CREATE POLICY "Admin can manage Microsoft 365 config" ON microsoft365_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tbutenti
      WHERE tbutenti.studio_id = microsoft365_config.studio_id
      AND tbutenti.email = auth.jwt()->>'email'
      AND tbutenti.tipo_utente = 'Admin'
    )
  );

-- Tabella per salvare i token di accesso Microsoft 365 per ogni utente
CREATE TABLE IF NOT EXISTS tbmicrosoft_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indice per ricerca veloce per utente
CREATE INDEX IF NOT EXISTS idx_microsoft_tokens_user ON tbmicrosoft_tokens(user_id);

-- RLS Policies
ALTER TABLE tbmicrosoft_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Solo l'utente può vedere i propri token
CREATE POLICY "Users can manage their own tokens" ON tbmicrosoft_tokens
  FOR ALL
  USING (auth.uid() = user_id);