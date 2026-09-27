-- AmmortaPro: categorie modificabili solo dall'Amministratore di sistema generale
CREATE OR REPLACE FUNCTION public.is_amministratore_sistema_generale()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tbutenti u
    WHERE (u.user_id = auth.uid() OR u.id = auth.uid())
      AND u.attivo IS TRUE
      AND u.amministratore_sistema_generale IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_amministratore_sistema_generale() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_amministratore_sistema_generale() TO authenticated;

DROP POLICY IF EXISTS "insert categorie cespiti studio" ON public.tbcespiti_categorie;
DROP POLICY IF EXISTS "update categorie cespiti studio" ON public.tbcespiti_categorie;
DROP POLICY IF EXISTS "delete categorie cespiti studio" ON public.tbcespiti_categorie;
DROP POLICY IF EXISTS "insert categorie cespiti" ON public.tbcespiti_categorie;
DROP POLICY IF EXISTS "update categorie cespiti" ON public.tbcespiti_categorie;
DROP POLICY IF EXISTS "delete categorie cespiti" ON public.tbcespiti_categorie;
DROP POLICY IF EXISTS "cespiti_insert_tbcespiti_categorie" ON public.tbcespiti_categorie;
DROP POLICY IF EXISTS "cespiti_update_tbcespiti_categorie" ON public.tbcespiti_categorie;
DROP POLICY IF EXISTS "cespiti_delete_tbcespiti_categorie" ON public.tbcespiti_categorie;
DROP POLICY IF EXISTS "ammortapro categorie insert admin generale" ON public.tbcespiti_categorie;
DROP POLICY IF EXISTS "ammortapro categorie update admin generale" ON public.tbcespiti_categorie;
DROP POLICY IF EXISTS "ammortapro categorie delete admin generale" ON public.tbcespiti_categorie;

CREATE POLICY "ammortapro categorie insert admin generale"
ON public.tbcespiti_categorie FOR INSERT TO authenticated
WITH CHECK (public.is_amministratore_sistema_generale());

CREATE POLICY "ammortapro categorie update admin generale"
ON public.tbcespiti_categorie FOR UPDATE TO authenticated
USING (public.is_amministratore_sistema_generale())
WITH CHECK (public.is_amministratore_sistema_generale());

CREATE POLICY "ammortapro categorie delete admin generale"
ON public.tbcespiti_categorie FOR DELETE TO authenticated
USING (public.is_amministratore_sistema_generale());

-- Le funzioni di installazione rispettano le RLS: niente bypass SECURITY DEFINER.
ALTER FUNCTION public.cespiti_installa_categorie_standard(uuid) SECURITY INVOKER;
ALTER FUNCTION public.cespiti_installa_categorie_immateriali(uuid) SECURITY INVOKER;
