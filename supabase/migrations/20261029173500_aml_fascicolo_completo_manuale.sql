alter table public."tbPraticheAML"
  add column if not exists fascicolo_completo_manuale boolean not null default false;
comment on column public."tbPraticheAML".fascicolo_completo_manuale is
  'Conferma esplicita del fascicolo da parte di un operatore autorizzato. Non equivale alla presenza materiale dei documenti richiesti.';
