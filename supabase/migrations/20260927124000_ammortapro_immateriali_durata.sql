-- AmmortaPro: immobilizzazioni immateriali e durata personalizzata
ALTER TABLE public.tbcespiti ADD COLUMN IF NOT EXISTS durata_anni_override numeric(8,3);

CREATE OR REPLACE FUNCTION public.cespiti_installa_categorie_immateriali(p_studio_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.tbcespiti_categorie
 (studio_id,codice,descrizione,natura,aliquota_civilistica,aliquota_fiscale,durata_anni,percentuale_deducibilita,riduzione_primo_anno_percentuale,attiva,note)
 VALUES
 (p_studio_id,'IMM-IMP','Costi di impianto e ampliamento','immateriale',20,20,5,100,0,true,'Durata standard proposta 5 anni, personalizzabile.'),
 (p_studio_id,'IMM-SVIL','Costi di sviluppo','immateriale',20,20,5,100,0,true,'Vita utile personalizzabile.'),
 (p_studio_id,'IMM-PLUR','Altri costi pluriennali','immateriale',20,20,5,100,0,true,'Default operativo 20%, personalizzabile.'),
 (p_studio_id,'IMM-BREV','Brevetti, opere ingegno, processi, formule e know-how','immateriale',50,50,2,100,0,true,'Limite fiscale art. 103 TUIR; civilistico personalizzabile secondo vita utile.'),
 (p_studio_id,'IMM-MARCHI','Marchi impresa','immateriale',5.5556,5.5556,18,100,0,true,'Limite fiscale 1/18; civilistico personalizzabile secondo vita utile.'),
 (p_studio_id,'IMM-AVV','Avviamento','immateriale',5.5556,5.5556,18,100,0,true,'Limite fiscale 1/18; civilistico personalizzabile.'),
 (p_studio_id,'IMM-LIC','Concessioni, licenze e altri diritti','immateriale',0,0,NULL,100,0,true,'Durata contrattuale o legale: impostare durata sul cespite.'),
 (p_studio_id,'IMM-SW','Software e diritti di utilizzazione software','immateriale',0,0,NULL,100,0,true,'Impostare vita utile o durata contrattuale sul cespite.'),
 (p_studio_id,'IMM-MIG','Migliorie e spese incrementative su beni di terzi','immateriale',0,0,NULL,100,0,true,'Impostare durata utile/contrattuale sul cespite.'),
 (p_studio_id,'IMM-ALTRE','Altre immobilizzazioni immateriali','immateriale',0,0,NULL,100,0,true,'Categoria residuale: impostare durata e trattamento specifici.')
 ON CONFLICT (studio_id,codice) DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.cespiti_installa_categorie_immateriali(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cespiti_installa_categorie_immateriali(uuid) TO authenticated;
