-- Aggiungi colonna flag_imu alla tabella tbclienti
ALTER TABLE public.tbclienti 
ADD COLUMN IF NOT EXISTS flag_imu BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.tbclienti.flag_imu IS 'Flag per abilitare lo scadenzario IMU per il cliente';