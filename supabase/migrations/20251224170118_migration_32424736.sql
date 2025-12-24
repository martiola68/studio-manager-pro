-- Tabella per tracciare le conferme di partecipazione
CREATE TABLE IF NOT EXISTS event_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento_id UUID NOT NULL REFERENCES tbagenda(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(evento_id, user_email)
);

-- Tabella per tracciare i reminder inviati
CREATE TABLE IF NOT EXISTS event_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento_id UUID NOT NULL REFERENCES tbagenda(id) ON DELETE CASCADE,
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(evento_id, sent_to)
);

-- Enable RLS
ALTER TABLE event_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

-- Policies per event_confirmations
CREATE POLICY "Users can view confirmations for their events" 
  ON event_confirmations FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert confirmations" 
  ON event_confirmations FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update their own confirmations" 
  ON event_confirmations FOR UPDATE 
  USING (true);

-- Policies per event_reminders
CREATE POLICY "Users can view reminders" 
  ON event_reminders FOR SELECT 
  USING (true);

CREATE POLICY "System can insert reminders" 
  ON event_reminders FOR INSERT 
  WITH CHECK (true);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_event_confirmations_evento ON event_confirmations(evento_id);
CREATE INDEX IF NOT EXISTS idx_event_confirmations_token ON event_confirmations(token);
CREATE INDEX IF NOT EXISTS idx_event_reminders_evento ON event_reminders(evento_id);