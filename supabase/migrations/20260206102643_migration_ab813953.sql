-- Tabella per memorizzare i token Microsoft 365
CREATE TABLE IF NOT EXISTS tbmicrosoft_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES tbutenti(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indice per query rapide
CREATE INDEX IF NOT EXISTS idx_microsoft_tokens_user_id ON tbmicrosoft_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_microsoft_tokens_expires_at ON tbmicrosoft_tokens(expires_at);

-- RLS Policies
ALTER TABLE tbmicrosoft_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Gli utenti possono vedere solo i propri token
CREATE POLICY "Users can view their own tokens" ON tbmicrosoft_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Gli utenti possono inserire i propri token
CREATE POLICY "Users can insert their own tokens" ON tbmicrosoft_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Gli utenti possono aggiornare i propri token
CREATE POLICY "Users can update their own tokens" ON tbmicrosoft_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Gli utenti possono eliminare i propri token
CREATE POLICY "Users can delete their own tokens" ON tbmicrosoft_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Aggiungi campo microsoft_event_id alla tabella tbagenda (CORRETTO DA tbeventoagenda)
ALTER TABLE tbagenda ADD COLUMN IF NOT EXISTS microsoft_event_id TEXT;
CREATE INDEX IF NOT EXISTS idx_evento_microsoft_id ON tbagenda(microsoft_event_id);

-- Tabella per impostazioni sincronizzazione Microsoft 365
CREATE TABLE IF NOT EXISTS tbmicrosoft_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES tbutenti(id) ON DELETE CASCADE,
  sync_calendar BOOLEAN DEFAULT true,
  auto_create_teams_meeting BOOLEAN DEFAULT true,
  send_email_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS per settings
ALTER TABLE tbmicrosoft_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own settings" ON tbmicrosoft_settings
  FOR ALL USING (auth.uid() = user_id);