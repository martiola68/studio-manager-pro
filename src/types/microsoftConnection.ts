export type MicrosoftConnection = {
  id: string;
  studio_id: string;
  nome_connessione: string;
  tenant_id: string | null;
  client_id: string | null;
  client_secret: string | null;
  enabled: boolean;
  connected_email: string | null;
  organizer_email: string | null;
  features: any;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
