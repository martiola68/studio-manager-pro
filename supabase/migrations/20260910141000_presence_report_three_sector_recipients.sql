-- Il vettore destinatari mantiene una posizione fissa per settore:
-- [0] Fiscale, [1] Lavoro, [2] Consulenza.
-- Le stringhe vuote sono ammesse e significano: salta l'invio del settore.

alter table public.tbpresenze_report_email_config
  drop constraint if exists tbpresenze_report_email_config_max_2_email;

alter table public.tbpresenze_report_email_config
  drop constraint if exists tbpresenze_report_email_config_max_3_email;

alter table public.tbpresenze_report_email_config
  add constraint tbpresenze_report_email_config_max_3_email
  check (cardinality(destinatari) <= 3);
