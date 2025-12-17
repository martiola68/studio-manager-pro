-- TABELLA TBClienti
CREATE TABLE TBClienti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_cliente TEXT UNIQUE NOT NULL,
  ragione_sociale TEXT NOT NULL,
  codice_fiscale TEXT NOT NULL,
  partita_iva TEXT NOT NULL,
  indirizzo TEXT NOT NULL,
  cap TEXT NOT NULL,
  citta TEXT NOT NULL,
  provincia TEXT NOT NULL,
  email TEXT NOT NULL,
  note TEXT,
  attivo BOOLEAN DEFAULT TRUE,
  utente_operatore_id UUID REFERENCES TBUtenti(id),
  utente_professionista_id UUID REFERENCES TBUtenti(id),
  contatto1_id UUID REFERENCES TBContatti(id),
  contatto2_id UUID REFERENCES TBContatti(id),
  scadenza_antiric DATE,
  tipo_prestazione_id UUID REFERENCES TBPrestazioni(id),
  tipo_cliente TEXT CHECK (tipo_cliente IN ('Interno', 'Esterno')),
  flag_iva BOOLEAN DEFAULT TRUE,
  flag_cu BOOLEAN DEFAULT TRUE,
  flag_bilancio BOOLEAN DEFAULT TRUE,
  flag_fiscali BOOLEAN DEFAULT TRUE,
  flag_lipe BOOLEAN DEFAULT TRUE,
  flag_770 BOOLEAN DEFAULT TRUE,
  flag_esterometro BOOLEAN DEFAULT TRUE,
  flag_ccgg BOOLEAN DEFAULT TRUE,
  flag_proforma BOOLEAN DEFAULT TRUE,
  flag_mail_attivo BOOLEAN DEFAULT TRUE,
  flag_mail_scadenze BOOLEAN DEFAULT TRUE,
  flag_mail_newsletter BOOLEAN DEFAULT TRUE,
  data_creazione TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBClienti ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Users can view all clienti" ON TBClienti FOR SELECT USING (true);
CREATE POLICY "Users can manage clienti" ON TBClienti FOR ALL USING (auth.uid() IS NOT NULL);

-- Funzione per generare cod_cliente automatico
CREATE OR REPLACE FUNCTION generate_cod_cliente()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cod_cliente := 'CLI' || LPAD(NEXTVAL('cod_cliente_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequenza per cod_cliente
CREATE SEQUENCE IF NOT EXISTS cod_cliente_seq START 1;

-- Trigger per cod_cliente
CREATE TRIGGER trigger_generate_cod_cliente
BEFORE INSERT ON TBClienti
FOR EACH ROW
WHEN (NEW.cod_cliente IS NULL OR NEW.cod_cliente = '')
EXECUTE FUNCTION generate_cod_cliente();