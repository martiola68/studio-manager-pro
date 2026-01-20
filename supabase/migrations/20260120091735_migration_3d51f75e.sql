-- FASE 1F: CREAZIONE TABELLA CredenzialiAccesso - Nuova tabella per gestione password
CREATE TABLE IF NOT EXISTS tbcredenziali_accesso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portale TEXT NOT NULL,
  indirizzo_url TEXT,
  login_utente TEXT,
  login_pw TEXT,
  login_pin TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  studio_id UUID REFERENCES tbstudio(id),
  created_by UUID REFERENCES tbutenti(id)
);

-- Aggiungi indici per performance
CREATE INDEX IF NOT EXISTS idx_credenziali_portale ON tbcredenziali_accesso(portale);
CREATE INDEX IF NOT EXISTS idx_credenziali_studio ON tbcredenziali_accesso(studio_id);

-- Aggiungi commenti per documentazione
COMMENT ON TABLE tbcredenziali_accesso IS 'Tabella per gestione credenziali accesso portali';
COMMENT ON COLUMN tbcredenziali_accesso.portale IS 'Nome portale (es: Entratel, Telemaco)';
COMMENT ON COLUMN tbcredenziali_accesso.indirizzo_url IS 'URL del portale';
COMMENT ON COLUMN tbcredenziali_accesso.login_utente IS 'Username di accesso';
COMMENT ON COLUMN tbcredenziali_accesso.login_pw IS 'Password di accesso';
COMMENT ON COLUMN tbcredenziali_accesso.login_pin IS 'PIN di accesso';
COMMENT ON COLUMN tbcredenziali_accesso.note IS 'Note aggiuntive';

-- Abilita RLS
ALTER TABLE tbcredenziali_accesso ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: utenti autenticati possono vedere credenziali del proprio studio
CREATE POLICY "Users can view credentials of their studio"
ON tbcredenziali_accesso FOR SELECT
TO authenticated
USING (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));

-- Policy INSERT: utenti autenticati possono inserire credenziali
CREATE POLICY "Users can insert credentials"
ON tbcredenziali_accesso FOR INSERT
TO authenticated
WITH CHECK (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));

-- Policy UPDATE: utenti autenticati possono aggiornare credenziali del proprio studio
CREATE POLICY "Users can update credentials of their studio"
ON tbcredenziali_accesso FOR UPDATE
TO authenticated
USING (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));

-- Policy DELETE: utenti autenticati possono eliminare credenziali del proprio studio
CREATE POLICY "Users can delete credentials of their studio"
ON tbcredenziali_accesso FOR DELETE
TO authenticated
USING (studio_id IN (SELECT studio_id FROM tbutenti WHERE id = auth.uid()));