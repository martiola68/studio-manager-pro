-- 1. ELIMINIAMO IL VINCOLO CHE BLOCCA TUTTO
ALTER TABLE tbscadfiscali DROP CONSTRAINT IF EXISTS tbscadfiscali_tipo_redditi_check;

-- 2. ORA POSSIAMO AGGIORNARE I DATI (senza vincolo che rompe le scatole)
UPDATE tbscadfiscali SET tipo_redditi = 'USC' WHERE tipo_redditi = 'SC';
UPDATE tbscadfiscali SET tipo_redditi = 'USP' WHERE tipo_redditi = 'SP';
UPDATE tbscadfiscali SET tipo_redditi = 'UPF' WHERE tipo_redditi = 'PF';

-- 3. ORA CHE I DATI SONO CORRETTI, RIMETTIAMO IL VINCOLO NUOVO
ALTER TABLE tbscadfiscali ADD CONSTRAINT tbscadfiscali_tipo_redditi_check 
  CHECK (tipo_redditi IN ('USC', 'USP', 'ENC', 'UPF', '730'));