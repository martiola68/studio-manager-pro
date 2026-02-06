ALTER TABLE public.tbstudio ADD COLUMN IF NOT EXISTS master_password_hash TEXT;
ALTER TABLE public.tbstudio ADD COLUMN IF NOT EXISTS protezione_attiva BOOLEAN DEFAULT false;