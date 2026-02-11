-- STEP 6: Creare trigger DB per auto-set studio_id (rete di sicurezza)

-- 1. Funzione che imposta automaticamente studio_id
CREATE OR REPLACE FUNCTION auto_set_studio_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se studio_id è NULL, recupera dallo studio dell'utente loggato
  IF NEW.studio_id IS NULL THEN
    SELECT studio_id INTO NEW.studio_id
    FROM tbutenti
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- Se ancora NULL dopo il recupero, BLOCCA l'operazione
    IF NEW.studio_id IS NULL THEN
      RAISE EXCEPTION 'Cannot insert/update cliente without studio_id. User has no studio assigned.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger BEFORE INSERT - imposta studio_id automaticamente
DROP TRIGGER IF EXISTS ensure_studio_id_before_insert ON tbclienti;
CREATE TRIGGER ensure_studio_id_before_insert
  BEFORE INSERT ON tbclienti
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_studio_id();

-- 3. Trigger BEFORE UPDATE - imposta studio_id automaticamente (se NULL)
DROP TRIGGER IF EXISTS ensure_studio_id_before_update ON tbclienti;
CREATE TRIGGER ensure_studio_id_before_update
  BEFORE UPDATE ON tbclienti
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_studio_id();