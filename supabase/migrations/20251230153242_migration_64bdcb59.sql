-- Step 1: Rimuovi il vecchio constraint
ALTER TABLE public.tbtipi_scadenze 
DROP CONSTRAINT IF EXISTS tbtipi_scadenze_tipo_scadenza_check;

-- Step 2: Crea nuovo constraint che include 'imu'
ALTER TABLE public.tbtipi_scadenze 
ADD CONSTRAINT tbtipi_scadenze_tipo_scadenza_check 
CHECK (tipo_scadenza = ANY (ARRAY[
  'iva'::text, 
  'fiscale'::text, 
  'bilancio'::text, 
  '770'::text, 
  'lipe'::text, 
  'esterometro'::text, 
  'ccgg'::text, 
  'cu'::text, 
  'proforma'::text, 
  'antiriciclaggio'::text,
  'imu'::text
]));

-- Step 3: Inserisci i 3 tipi di scadenza IMU
DO $$
DECLARE
  v_studio_id uuid;
BEGIN
  -- Recupera lo studio_id
  SELECT id INTO v_studio_id 
  FROM public.tbstudio 
  LIMIT 1;
  
  -- Acconto IMU (16 Giugno)
  INSERT INTO public.tbtipi_scadenze (
    id,
    nome,
    descrizione,
    data_scadenza,
    tipo_scadenza,
    ricorrente,
    giorni_preavviso_1,
    giorni_preavviso_2,
    attivo,
    studio_id
  )
  SELECT 
    gen_random_uuid(),
    'IMU Acconto',
    'Scadenza acconto IMU - 16 Giugno',
    (EXTRACT(YEAR FROM CURRENT_DATE) || '-06-16')::date,
    'imu',
    true,
    30,
    15,
    true,
    v_studio_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tbtipi_scadenze 
    WHERE tipo_scadenza = 'imu' AND nome = 'IMU Acconto'
  );
  
  -- Saldo IMU (16 Dicembre)
  INSERT INTO public.tbtipi_scadenze (
    id,
    nome,
    descrizione,
    data_scadenza,
    tipo_scadenza,
    ricorrente,
    giorni_preavviso_1,
    giorni_preavviso_2,
    attivo,
    studio_id
  )
  SELECT 
    gen_random_uuid(),
    'IMU Saldo',
    'Scadenza saldo IMU - 16 Dicembre',
    (EXTRACT(YEAR FROM CURRENT_DATE) || '-12-16')::date,
    'imu',
    true,
    30,
    15,
    true,
    v_studio_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tbtipi_scadenze 
    WHERE tipo_scadenza = 'imu' AND nome = 'IMU Saldo'
  );
  
  -- Dichiarazione IMU (30 Giugno anno successivo)
  INSERT INTO public.tbtipi_scadenze (
    id,
    nome,
    descrizione,
    data_scadenza,
    tipo_scadenza,
    ricorrente,
    giorni_preavviso_1,
    giorni_preavviso_2,
    attivo,
    studio_id
  )
  SELECT 
    gen_random_uuid(),
    'IMU Dichiarazione',
    'Scadenza dichiarazione IMU - 30 Giugno',
    ((EXTRACT(YEAR FROM CURRENT_DATE) + 1) || '-06-30')::date,
    'imu',
    true,
    60,
    30,
    true,
    v_studio_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tbtipi_scadenze 
    WHERE tipo_scadenza = 'imu' AND nome = 'IMU Dichiarazione'
  );
  
END $$;