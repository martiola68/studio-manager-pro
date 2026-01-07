-- Create scadenze_770 table
CREATE TABLE IF NOT EXISTS scadenze_770 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES tbclienti(id) ON DELETE CASCADE,
  anno INTEGER NOT NULL,
  data_scadenza DATE NOT NULL,
  stato TEXT NOT NULL CHECK (stato IN ('da_fare', 'in_lavorazione', 'completato')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scadenze_770 ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view scadenze_770" ON scadenze_770 FOR SELECT USING (true);
CREATE POLICY "Users can insert scadenze_770" ON scadenze_770 FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update scadenze_770" ON scadenze_770 FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete scadenze_770" ON scadenze_770 FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_scadenze_770_cliente_id ON scadenze_770(cliente_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_770_anno ON scadenze_770(anno);
CREATE INDEX IF NOT EXISTS idx_scadenze_770_data_scadenza ON scadenze_770(data_scadenza);