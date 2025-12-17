-- Tabella Utenti estesa (oltre profiles di Supabase)
CREATE TABLE IF NOT EXISTS utenti (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  tipo_utente TEXT NOT NULL CHECK (tipo_utente IN ('Admin', 'User')),
  ruolo_operatore TEXT,
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE utenti ENABLE ROW LEVEL SECURITY;

-- Policies per utenti
CREATE POLICY "Users can view all utenti" ON utenti FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert their own utente" ON utenti FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own utente" ON utenti FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can manage all utenti" ON utenti FOR ALL USING (
  EXISTS (
    SELECT 1 FROM utenti WHERE id = auth.uid() AND tipo_utente = 'Admin'
  )
);