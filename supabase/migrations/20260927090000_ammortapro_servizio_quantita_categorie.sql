-- AmmortaPro: servizio cliente, quantità cespiti e categorie standard "Altre attività"
ALTER TABLE public.tbclienti_servizi ADD COLUMN IF NOT EXISTS ammortamenti boolean NOT NULL DEFAULT false;
ALTER TABLE public.tbcespiti ADD COLUMN IF NOT EXISTS quantita numeric(12,3) NOT NULL DEFAULT 1;
ALTER TABLE public.tbcespiti DROP CONSTRAINT IF EXISTS tbcespiti_quantita_positiva;
ALTER TABLE public.tbcespiti ADD CONSTRAINT tbcespiti_quantita_positiva CHECK (quantita > 0);

CREATE OR REPLACE FUNCTION public.cespiti_installa_categorie_standard(p_studio_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.tbcespiti_categorie
 (studio_id,codice,descrizione,natura,aliquota_civilistica,aliquota_fiscale,percentuale_deducibilita,riduzione_primo_anno_percentuale,attiva,note)
 VALUES
 (p_studio_id,'ALT-EDIF','Edifici','materiale',3,3,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-GDO','Fabbricati destinati alla grande distribuzione','materiale',6,6,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-COSTL','Costruzioni leggere (tettoie, baracche, ecc.)','materiale',10,10,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-SOLL','Impianti e mezzi di sollevamento, carico, scarico e pesatura','materiale',7.5,7.5,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-ATTR','Macchinari, apparecchi e attrezzature varie','materiale',15,15,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-STIG','Stigliatura','materiale',10,10,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-ARR','Arredamento','materiale',15,15,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-BANC','Banconi blindati o con cristalli blindati','materiale',20,20,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-ALL','Impianti di allarme e di ripresa fotografica, cinematografica e televisiva','materiale',30,30,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-COM','Impianti interni speciali di comunicazione e telesegnalazione','materiale',25,25,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-DEP','Impianti trattamento/depurazione acque e fumi con reagenti chimici','materiale',15,15,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-UFF','Mobili e macchine ordinarie d''ufficio','materiale',12,12,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-ELET','Macchine d''ufficio elettromeccaniche/elettroniche, computer e sistemi telefonici elettronici','materiale',20,20,100,50,true,'D.M. 31/12/1988 - Altre attività'),
 (p_studio_id,'ALT-TRASP','Autoveicoli da trasporto','materiale',20,20,100,50,true,'Coefficiente D.M. 31/12/1988. Verificare eventuali limiti fiscali specifici in base a veicolo e utilizzo.'),
 (p_studio_id,'ALT-AUTO','Autovetture, motoveicoli e simili','materiale',25,25,100,50,true,'Coefficiente D.M. 31/12/1988. Deducibilità da personalizzare secondo soggetto, veicolo e utilizzo.')
 ON CONFLICT (studio_id,codice) DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.cespiti_installa_categorie_standard(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cespiti_installa_categorie_standard(uuid) TO authenticated;
