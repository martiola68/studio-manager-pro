-- Step 2: Rimuovere il vecchio constraint
ALTER TABLE tbscadfiscali 
DROP CONSTRAINT IF EXISTS tbscadfiscali_tipo_redditi_check;