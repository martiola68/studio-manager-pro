-- Migration: Elimina constraint e colonna tipo_liq da tbscadlipe
-- Sicuro con IF EXISTS per compatibilità multi-ambiente

-- 1. Elimina il constraint CHECK su tipo_liq (se esiste)
ALTER TABLE public.tbscadlipe 
DROP CONSTRAINT IF EXISTS tbscadlipe_tipo_liq_check;

-- 2. Elimina la colonna tipo_liq (se esiste)
ALTER TABLE public.tbscadlipe 
DROP COLUMN IF EXISTS tipo_liq;