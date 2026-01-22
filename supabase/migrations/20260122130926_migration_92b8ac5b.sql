-- Drop existing table with CASCADE to remove dependencies
DROP TABLE IF EXISTS tbcredenziali_accesso CASCADE;

-- Recreate table WITHOUT studio_id
CREATE TABLE tbcredenziali_accesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portale text NOT NULL,
  indirizzo_url text,
  login_utente text,
  login_pw text,
  login_pin text,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE tbcredenziali_accesso ENABLE ROW LEVEL SECURITY;

-- RLS Policies: ALL authenticated users can access ALL credentials (no studio filter)
CREATE POLICY "Authenticated users can view all credentials"
  ON tbcredenziali_accesso
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert credentials"
  ON tbcredenziali_accesso
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update all credentials"
  ON tbcredenziali_accesso
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete all credentials"
  ON tbcredenziali_accesso
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster queries
CREATE INDEX idx_tbcredenziali_portale ON tbcredenziali_accesso(portale);

-- Add comment
COMMENT ON TABLE tbcredenziali_accesso IS 'Credenziali di accesso ai portali esterni - condivise da tutti gli utenti';