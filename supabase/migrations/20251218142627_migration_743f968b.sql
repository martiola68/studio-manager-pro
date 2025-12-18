-- Ricostruzione completa tbscadlipe con nuova struttura (Iva per. e Lipe)
DROP TABLE IF EXISTS tbscadlipe CASCADE;

CREATE TABLE tbscadlipe (
  id uuid PRIMARY KEY REFERENCES tbclienti(id) ON DELETE CASCADE,
  nominativo text NOT NULL,
  utente_professionista_id uuid REFERENCES tbutenti(id) ON DELETE SET NULL,
  utente_operatore_id uuid REFERENCES tbutenti(id) ON DELETE SET NULL,
  
  -- Configurazione
  tipo_liq text CHECK (tipo_liq IN ('M', 'T')),
  
  -- Trimestre 1 (Gen-Feb-Mar)
  gen boolean DEFAULT false,
  feb boolean DEFAULT false,
  mar boolean DEFAULT false,
  lipe1t boolean DEFAULT false,
  lipe1t_invio date,
  
  -- Trimestre 2 (Apr-Mag-Giu)
  apr boolean DEFAULT false,
  mag boolean DEFAULT false,
  giu boolean DEFAULT false,
  lipe2t boolean DEFAULT false,
  lipe2t_invio date,
  
  -- Trimestre 3 (Lug-Ago-Set)
  lug boolean DEFAULT false,
  ago boolean DEFAULT false,
  set boolean DEFAULT false,
  lipe3t boolean DEFAULT false,
  lipe3t_invio date,
  
  -- Trimestre 4 (Ott-Nov-Dic) + Acconto
  ott boolean DEFAULT false,
  nov boolean DEFAULT false,
  acconto text CHECK (acconto IN ('Dovuto', 'Non dovuto')),
  acconto_com boolean DEFAULT false,
  dic boolean DEFAULT false,
  lipe4t boolean DEFAULT false,
  lipe4t_invio date,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Trigger per updated_at
CREATE TRIGGER update_tbscadlipe_updated_at
  BEFORE UPDATE ON tbscadlipe
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Abilita RLS
ALTER TABLE tbscadlipe ENABLE ROW LEVEL SECURITY;

-- Politiche RLS
CREATE POLICY "Tutti possono visualizzare tbscadlipe"
  ON tbscadlipe FOR SELECT
  USING (true);

CREATE POLICY "Utenti autenticati possono inserire tbscadlipe"
  ON tbscadlipe FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Utenti autenticati possono aggiornare tbscadlipe"
  ON tbscadlipe FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Utenti autenticati possono eliminare tbscadlipe"
  ON tbscadlipe FOR DELETE
  USING (auth.uid() IS NOT NULL);