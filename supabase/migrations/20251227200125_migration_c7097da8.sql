-- Aggiorna il trigger per gestire anche i campi extra passati nella creazione
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserisce in tbutenti usando l'UUID di auth e i metadata
  INSERT INTO public.tbutenti (
    id, 
    email, 
    nome, 
    cognome, 
    tipo_utente,
    attivo
  )
  VALUES (
    new.id,  -- Usa lo stesso UUID di auth.users
    new.email,
    COALESCE(new.raw_user_meta_data->>'nome', ''),
    COALESCE(new.raw_user_meta_data->>'cognome', ''),
    COALESCE(new.raw_user_meta_data->>'tipo_utente', 'User'),
    true
  )
  ON CONFLICT (id) DO NOTHING;  -- Evita errori se già esiste
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ricrea il trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a tbutenti profile when a new auth user is created, using the same UUID. Uses ON CONFLICT to avoid duplicate key errors.';