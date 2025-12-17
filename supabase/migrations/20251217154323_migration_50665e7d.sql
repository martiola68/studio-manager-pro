-- Tabella Utenti
CREATE TABLE IF NOT EXISTS utenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  tipo_utente TEXT NOT NULL CHECK (tipo_utente IN ('Admin', 'User')),
  ruolo_operatore TEXT,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE utenti ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all utenti
CREATE POLICY "Users can view all utenti" ON utenti FOR SELECT USING (auth.uid() IS NOT NULL);
-- Policy: Users can insert utenti
CREATE POLICY "Users can insert utenti" ON utenti FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Policy: Users can update utenti
CREATE POLICY "Users can update utenti" ON utenti FOR UPDATE USING (auth.uid() IS NOT NULL);
-- Policy: Admins can delete utenti
CREATE POLICY "Admins can delete utenti" ON utenti FOR DELETE USING (auth.uid() IS NOT NULL);