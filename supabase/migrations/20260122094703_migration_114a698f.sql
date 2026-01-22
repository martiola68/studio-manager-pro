-- STEP 1: Drop existing tbscadimu table
DROP TABLE IF EXISTS tbscadimu CASCADE;

-- STEP 2: Create new tbscadimu table with correct structure
CREATE TABLE tbscadimu (
  id uuid PRIMARY KEY REFERENCES tbclienti(id) ON DELETE CASCADE,
  nominativo text,
  professionista text,
  operatore text,
  acconto_imu boolean DEFAULT false,
  acconto_dovuto boolean DEFAULT false,
  acconto_comunicato boolean DEFAULT false,
  data_com_acconto date,
  saldo_imu boolean DEFAULT false,
  saldo_dovuto boolean DEFAULT false,
  saldo_comunicato boolean DEFAULT false,
  data_com_saldo date,
  dichiarazione_imu boolean DEFAULT false,
  data_scad_dichiarazione date,
  dichiarazione_presentata boolean DEFAULT false,
  data_presentazione date,
  note text,
  conferma_riga boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- STEP 3: Enable RLS
ALTER TABLE tbscadimu ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create RLS policies
CREATE POLICY "Users can view IMU records for their studio clients"
  ON tbscadimu FOR SELECT
  USING (
    id IN (
      SELECT c.id 
      FROM tbclienti c
      INNER JOIN tbutenti u ON u.id = auth.uid()
      WHERE c.id = tbscadimu.id
    )
  );

CREATE POLICY "Users can insert IMU records for their studio clients"
  ON tbscadimu FOR INSERT
  WITH CHECK (
    id IN (
      SELECT c.id 
      FROM tbclienti c
      INNER JOIN tbutenti u ON u.id = auth.uid()
      WHERE c.id = tbscadimu.id
    )
  );

CREATE POLICY "Users can update IMU records for their studio clients"
  ON tbscadimu FOR UPDATE
  USING (
    id IN (
      SELECT c.id 
      FROM tbclienti c
      INNER JOIN tbutenti u ON u.id = auth.uid()
      WHERE c.id = tbscadimu.id
    )
  );

CREATE POLICY "Users can delete IMU records for their studio clients"
  ON tbscadimu FOR DELETE
  USING (
    id IN (
      SELECT c.id 
      FROM tbclienti c
      INNER JOIN tbutenti u ON u.id = auth.uid()
      WHERE c.id = tbscadimu.id
    )
  );