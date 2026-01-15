-- Drop existing constraint
ALTER TABLE tbtipi_scadenze DROP CONSTRAINT tbtipi_scadenze_tipo_scadenza_check;

-- Add new constraint with 'lavoro' included
ALTER TABLE tbtipi_scadenze ADD CONSTRAINT tbtipi_scadenze_tipo_scadenza_check 
CHECK (tipo_scadenza IN ('iva', 'fiscale', 'bilancio', '770', 'lipe', 'esterometro', 'ccgg', 'cu', 'proforma', 'antiriciclaggio', 'imu', 'lavoro'));