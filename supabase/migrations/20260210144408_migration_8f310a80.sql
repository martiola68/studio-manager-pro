-- Aggiunta colonne per configurazione Teams
ALTER TABLE microsoft365_config
ADD COLUMN IF NOT EXISTS teams_default_team_id text,
ADD COLUMN IF NOT EXISTS teams_default_channel_id text,
ADD COLUMN IF NOT EXISTS teams_scadenze_channel_id text,
ADD COLUMN IF NOT EXISTS teams_alert_channel_id text;

-- Creazione tabella per mapping calendario (RIFERIMENTO CORRETTO: tbagenda)
CREATE TABLE IF NOT EXISTS tbmicrosoft_calendar_mappings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  evento_id uuid NOT NULL REFERENCES tbagenda(id) ON DELETE CASCADE,
  outlook_event_id text NOT NULL,
  last_synced timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(evento_id),
  UNIQUE(outlook_event_id)
);

-- Abilitazione RLS per tbmicrosoft_calendar_mappings
ALTER TABLE tbmicrosoft_calendar_mappings ENABLE ROW LEVEL SECURITY;

-- Policy per tbmicrosoft_calendar_mappings
CREATE POLICY "Users can manage calendar mappings"
  ON tbmicrosoft_calendar_mappings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tbagenda
      WHERE tbagenda.id = tbmicrosoft_calendar_mappings.evento_id
      AND tbagenda.utente_id = auth.uid()
    )
  );

COMMENT ON TABLE tbmicrosoft_calendar_mappings IS 'Mapping tra eventi locali (tbagenda) e eventi Microsoft Outlook Calendar';
COMMENT ON COLUMN microsoft365_config.teams_default_team_id IS 'ID del team Microsoft Teams predefinito per le notifiche';
COMMENT ON COLUMN microsoft365_config.teams_default_channel_id IS 'ID del canale Teams predefinito per notifiche generali';
COMMENT ON COLUMN microsoft365_config.teams_scadenze_channel_id IS 'ID del canale Teams per notifiche scadenze';
COMMENT ON COLUMN microsoft365_config.teams_alert_channel_id IS 'ID del canale Teams per alert critici';