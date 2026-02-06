-- Tabella per i token di reset Master Password
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id UUID NOT NULL REFERENCES public.tbstudio(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Index per performance
CREATE INDEX IF NOT EXISTS idx_password_reset_studio ON public.password_reset_tokens(studio_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON public.password_reset_tokens(expires_at);

-- RLS Policies
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Solo admin possono creare token
CREATE POLICY "Admin can create reset tokens" ON public.password_reset_tokens
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tbutenti
      WHERE email = auth.jwt()->>'email'
      AND tipo_utente = 'Admin'
    )
  );

-- Policy: Solo admin possono leggere i propri token
CREATE POLICY "Admin can view own reset tokens" ON public.password_reset_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tbutenti
      WHERE email = auth.jwt()->>'email'
      AND tipo_utente = 'Admin'
    )
  );

-- Policy: Solo admin possono aggiornare i propri token
CREATE POLICY "Admin can update own reset tokens" ON public.password_reset_tokens
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tbutenti
      WHERE email = auth.jwt()->>'email'
      AND tipo_utente = 'Admin'
    )
  );