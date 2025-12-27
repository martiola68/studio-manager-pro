-- SOLUZIONE DEFINITIVA: Trigger per sincronizzare auth.users con tbutenti
-- Crea funzione che inserisce automaticamente il profilo utente

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserisci nuovo utente in tbutenti usando lo stesso ID di auth.users
  INSERT INTO public.tbutenti (
    id, 
    email, 
    nome, 
    cognome, 
    tipo_utente, 
    attivo,
    created_at,
    updated_at
  )
  VALUES (
    new.id,  -- USA LO STESSO UUID DI AUTH.USERS!
    new.email,
    COALESCE(new.raw_user_meta_data->>'nome', 'Nome'),
    COALESCE(new.raw_user_meta_data->>'cognome', 'Cognome'),
    COALESCE(new.raw_user_meta_data->>'tipo_utente', 'Utente'),
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;  -- Se esiste già, non fare nulla
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crea trigger che chiama la funzione
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Aggiungi commento per documentazione
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function that automatically creates a tbutenti profile when a new auth user is created, using the same UUID';