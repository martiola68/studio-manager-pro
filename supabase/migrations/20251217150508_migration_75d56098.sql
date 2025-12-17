-- Funzione per aggiornare automaticamente updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per tutte le tabelle
CREATE TRIGGER update_studios_updated_at BEFORE UPDATE ON studios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_utenti_updated_at BEFORE UPDATE ON utenti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clienti_updated_at BEFORE UPDATE ON clienti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contatti_updated_at BEFORE UPDATE ON contatti FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scadenze_updated_at BEFORE UPDATE ON scadenze FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_eventi_agenda_updated_at BEFORE UPDATE ON eventi_agenda FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comunicazioni_updated_at BEFORE UPDATE ON comunicazioni FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();