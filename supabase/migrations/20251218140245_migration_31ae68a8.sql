-- Modifica struttura tbscadfiscali
ALTER TABLE tbscadfiscali 
  DROP COLUMN IF EXISTS acconto1,
  DROP COLUMN IF EXISTS acconto1_data,
  DROP COLUMN IF EXISTS acconto2,
  DROP COLUMN IF EXISTS acconto2_data,
  DROP COLUMN IF EXISTS saldo,
  DROP COLUMN IF EXISTS saldo_data,
  DROP COLUMN IF EXISTS ricevuta_r;

-- Aggiungi i nuovi campi
ALTER TABLE tbscadfiscali 
  ADD COLUMN IF NOT EXISTS mod_r_compilato boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mod_r_definitivo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mod_r_inviato boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_r_invio date,
  ADD COLUMN IF NOT EXISTS ricevuta_r boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS con_irap boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mod_i_compilato boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mod_i_definitivo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mod_i_inviato boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_i_invio date,
  ADD COLUMN IF NOT EXISTS conferma_invii boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS saldo_acc_cciaa boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_com1 date,
  ADD COLUMN IF NOT EXISTS acc2 boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_com2 date;