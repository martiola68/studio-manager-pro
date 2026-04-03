export const CASSETTI_FISCALI_SENSITIVE_FIELDS = [
  "username",
  "password1",
  "password2",
  "pin",
  "pw_iniziale",
] as const;

export const CLIENTI_SENSITIVE_FIELDS = [
  "codice_fiscale",
  "partita_iva",
  "matricola_inps",
  "pat_inail",
  "codice_ditta_ce",
  "note",
] as const;

export const CREDENZIALI_ACCESSO_SENSITIVE_FIELDS = [
  "login_pw",
  "login_pin",
] as const;
