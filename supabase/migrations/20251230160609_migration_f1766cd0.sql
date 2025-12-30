-- Aggiungi colonna deleted_at per soft delete dei messaggi
ALTER TABLE public.tbmessaggi 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.tbmessaggi.deleted_at IS 'Timestamp di eliminazione del messaggio (soft delete)';