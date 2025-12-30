-- Crea tabella tbscadimu per gestione scadenze IMU (senza FK su tbruoli)
CREATE TABLE IF NOT EXISTS public.tbscadimu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES public.tbstudio(id) ON DELETE CASCADE,
  nominativo TEXT NOT NULL,
  
  -- Assegnazioni
  utente_professionista_id UUID REFERENCES public.tbutenti(id) ON DELETE SET NULL,
  utente_operatore_id UUID REFERENCES public.tbutenti(id) ON DELETE SET NULL,
  
  -- Acconto IMU
  acconto_imu BOOLEAN DEFAULT false,
  acconto_dovuto BOOLEAN DEFAULT false,
  acconto_comunicato BOOLEAN DEFAULT false,
  acconto_data DATE,
  
  -- Saldo IMU
  saldo_imu BOOLEAN DEFAULT false,
  saldo_dovuto BOOLEAN DEFAULT false,
  saldo_comunicato BOOLEAN DEFAULT false,
  saldo_data DATE,
  
  -- Dichiarazione IMU
  dichiarazione_imu BOOLEAN DEFAULT false,
  dichiarazione_scadenza DATE,
  dichiarazione_presentazione BOOLEAN DEFAULT false,
  dichiarazione_data_pres DATE,
  
  -- Metadati
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tbscadimu ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view records from their studio
CREATE POLICY "Users can view their studio IMU records"
  ON public.tbscadimu
  FOR SELECT
  USING (
    studio_id IN (
      SELECT studio_id FROM public.tbutenti WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert records in their studio
CREATE POLICY "Users can insert IMU records in their studio"
  ON public.tbscadimu
  FOR INSERT
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.tbutenti WHERE id = auth.uid()
    )
  );

-- Policy: Users can update records from their studio
CREATE POLICY "Users can update their studio IMU records"
  ON public.tbscadimu
  FOR UPDATE
  USING (
    studio_id IN (
      SELECT studio_id FROM public.tbutenti WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete records from their studio
CREATE POLICY "Users can delete their studio IMU records"
  ON public.tbscadimu
  FOR DELETE
  USING (
    studio_id IN (
      SELECT studio_id FROM public.tbutenti WHERE id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_tbscadimu_studio ON public.tbscadimu(studio_id);
CREATE INDEX idx_tbscadimu_professionista ON public.tbscadimu(utente_professionista_id);
CREATE INDEX idx_tbscadimu_operatore ON public.tbscadimu(utente_operatore_id);
CREATE INDEX idx_tbscadimu_acconto_data ON public.tbscadimu(acconto_data);
CREATE INDEX idx_tbscadimu_saldo_data ON public.tbscadimu(saldo_data);
CREATE INDEX idx_tbscadimu_dichiarazione_scadenza ON public.tbscadimu(dichiarazione_scadenza);

-- Comments
COMMENT ON TABLE public.tbscadimu IS 'Tabella per gestione scadenze IMU';
COMMENT ON COLUMN public.tbscadimu.nominativo IS 'Nome del cliente/immobile';
COMMENT ON COLUMN public.tbscadimu.acconto_imu IS 'Flag per acconto IMU';
COMMENT ON COLUMN public.tbscadimu.saldo_imu IS 'Flag per saldo IMU';
COMMENT ON COLUMN public.tbscadimu.dichiarazione_imu IS 'Flag per dichiarazione IMU';