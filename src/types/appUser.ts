// src/types/appUser.ts
export type AppUserBase = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  tipo_utente: string;
  studio_id: string | null;
  settore: string | null;
  ruolo_operatore_id: string | null;
  attivo: boolean | null;
};

export type AppUserPermessi = AppUserBase & {
  responsabile: boolean | null;
};
