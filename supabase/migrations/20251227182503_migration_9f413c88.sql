-- Creazione tabella conversazioni
CREATE TABLE IF NOT EXISTS tbconversazioni (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titolo TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('diretta', 'gruppo')) DEFAULT 'diretta',
  studio_id UUID NOT NULL REFERENCES tbstudio(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creazione tabella partecipanti conversazioni
CREATE TABLE IF NOT EXISTS tbconversazioni_utenti (
  conversazione_id UUID NOT NULL REFERENCES tbconversazioni(id) ON DELETE CASCADE,
  utente_id UUID NOT NULL REFERENCES tbutenti(id) ON DELETE CASCADE,
  ultimo_letto_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (conversazione_id, utente_id)
);

-- Creazione tabella messaggi (corretta con tbagenda)
CREATE TABLE IF NOT EXISTS tbmessaggi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversazione_id UUID NOT NULL REFERENCES tbconversazioni(id) ON DELETE CASCADE,
  mittente_id UUID NOT NULL REFERENCES tbutenti(id) ON DELETE CASCADE,
  testo TEXT NOT NULL,
  cliente_id UUID REFERENCES tbclienti(id) ON DELETE SET NULL,
  evento_id UUID REFERENCES tbagenda(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_conversazioni_studio ON tbconversazioni(studio_id);
CREATE INDEX IF NOT EXISTS idx_conversazioni_utenti_utente ON tbconversazioni_utenti(utente_id);
CREATE INDEX IF NOT EXISTS idx_conversazioni_utenti_conversazione ON tbconversazioni_utenti(conversazione_id);
CREATE INDEX IF NOT EXISTS idx_messaggi_conversazione ON tbmessaggi(conversazione_id);
CREATE INDEX IF NOT EXISTS idx_messaggi_mittente ON tbmessaggi(mittente_id);
CREATE INDEX IF NOT EXISTS idx_messaggi_created ON tbmessaggi(created_at DESC);

-- RLS Policies per tbconversazioni
ALTER TABLE tbconversazioni ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view conversations they participate in' AND tablename = 'tbconversazioni') THEN
        CREATE POLICY "Users can view conversations they participate in" ON tbconversazioni
        FOR SELECT 
        USING (
          id IN (
            SELECT conversazione_id 
            FROM tbconversazioni_utenti 
            WHERE utente_id = auth.uid()
          )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create conversations in their studio' AND tablename = 'tbconversazioni') THEN
        CREATE POLICY "Users can create conversations in their studio" ON tbconversazioni
        FOR INSERT 
        WITH CHECK (
          studio_id IN (
            SELECT tbstudio.id 
            FROM tbstudio 
            LIMIT 1
          )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their conversations' AND tablename = 'tbconversazioni') THEN
        CREATE POLICY "Users can update their conversations" ON tbconversazioni
        FOR UPDATE 
        USING (
          id IN (
            SELECT conversazione_id 
            FROM tbconversazioni_utenti 
            WHERE utente_id = auth.uid()
          )
        );
    END IF;
END $$;

-- RLS Policies per tbconversazioni_utenti
ALTER TABLE tbconversazioni_utenti ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view conversation participants' AND tablename = 'tbconversazioni_utenti') THEN
        CREATE POLICY "Users can view conversation participants" ON tbconversazioni_utenti
        FOR SELECT 
        USING (
          conversazione_id IN (
            SELECT conversazione_id 
            FROM tbconversazioni_utenti 
            WHERE utente_id = auth.uid()
          )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can add participants to conversations' AND tablename = 'tbconversazioni_utenti') THEN
        CREATE POLICY "Users can add participants to conversations" ON tbconversazioni_utenti
        FOR INSERT 
        WITH CHECK (
          conversazione_id IN (
            SELECT conversazione_id 
            FROM tbconversazioni_utenti 
            WHERE utente_id = auth.uid()
          )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their participation' AND tablename = 'tbconversazioni_utenti') THEN
        CREATE POLICY "Users can update their participation" ON tbconversazioni_utenti
        FOR UPDATE 
        USING (utente_id = auth.uid());
    END IF;
END $$;

-- RLS Policies per tbmessaggi
ALTER TABLE tbmessaggi ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view messages in their conversations' AND tablename = 'tbmessaggi') THEN
        CREATE POLICY "Users can view messages in their conversations" ON tbmessaggi
        FOR SELECT 
        USING (
          conversazione_id IN (
            SELECT conversazione_id 
            FROM tbconversazioni_utenti 
            WHERE utente_id = auth.uid()
          )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can send messages in their conversations' AND tablename = 'tbmessaggi') THEN
        CREATE POLICY "Users can send messages in their conversations" ON tbmessaggi
        FOR INSERT 
        WITH CHECK (
          conversazione_id IN (
            SELECT conversazione_id 
            FROM tbconversazioni_utenti 
            WHERE utente_id = auth.uid()
          ) AND mittente_id = auth.uid()
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own messages' AND tablename = 'tbmessaggi') THEN
        CREATE POLICY "Users can update their own messages" ON tbmessaggi
        FOR UPDATE 
        USING (mittente_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own messages' AND tablename = 'tbmessaggi') THEN
        CREATE POLICY "Users can delete their own messages" ON tbmessaggi
        FOR DELETE 
        USING (mittente_id = auth.uid());
    END IF;
END $$;