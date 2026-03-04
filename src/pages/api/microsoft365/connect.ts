// 4) Salva lo state in tbmicrosoft_settings

// 4) Salva lo state in tbmicrosoft_settings
const { error: upStateErr } = await supabaseAdmin
  .from("tbmicrosoft_settings")
  .upsert(
    {
      user_id: userId,
      m365_oauth_state: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

if (upStateErr) {
  return res.status(500).json({ error: `Errore salvataggio state: ${upStateErr.message}` });
}

// 5) Costruisci authorize URL (delegated)
const redirectUri = `${appBaseUrl(req)}/api/microsoft365/callback`;

const params = new URLSearchParams({
  client_id: cfg.client_id,
  response_type: "code",
  redirect_uri: redirectUri,
  response_mode: "query",
  scope: "openid profile offline_access User.Read Calendars.ReadWrite Mail.Send",
  prompt: "consent",
  state,
});

const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
