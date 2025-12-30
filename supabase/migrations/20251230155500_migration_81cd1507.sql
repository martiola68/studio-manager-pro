-- Modifica il campo dichiarazione_imu da boolean a text con valori SI/NO
ALTER TABLE public.tbscadimu 
ALTER COLUMN dichiarazione_imu TYPE text;

-- Aggiorna valori esistenti: true → 'SI', false/null → 'NO'
UPDATE public.tbscadimu 
SET dichiarazione_imu = CASE 
  WHEN dichiarazione_imu::text = 'true' THEN 'SI'
  ELSE 'NO'
END;

-- Imposta default 'NO'
ALTER TABLE public.tbscadimu 
ALTER COLUMN dichiarazione_imu SET DEFAULT 'NO';

-- Aggiungi constraint per accettare solo 'SI' o 'NO'
ALTER TABLE public.tbscadimu 
ADD CONSTRAINT dichiarazione_imu_check CHECK (dichiarazione_imu IN ('SI', 'NO'));

COMMENT ON COLUMN public.tbscadimu.dichiarazione_imu IS 'Dichiarazione IMU da presentare - Valori: SI o NO';