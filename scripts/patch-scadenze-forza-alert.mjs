import fs from "node:fs";

function replaceOnce(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) {
    throw new Error(`[patch-scadenze-forza-alert] Anchor non trovato: ${label}`);
  }
  return source.replace(oldValue, newValue);
}

// API riepilogo: espone al frontend solo il flag amministratore generale.
{
  const filePath = "src/pages/api/scadenze-centrale.ts";
  let source = fs.readFileSync(filePath, "utf8");

  source = replaceOnce(
    source,
    `        tipo_utente,\n        attivo\n      \`)`,
    `        tipo_utente,\n        attivo,\n        amministratore_sistema_generale\n      \`)`,
    "select flag admin generale"
  );

  source = replaceOnce(
    source,
    `        tipo_utente:\n          utente.tipo_utente,\n      },`,
    `        tipo_utente:\n          utente.tipo_utente,\n        amministratore_sistema_generale:\n          !!utente.amministratore_sistema_generale,\n      },`,
    "response flag admin generale"
  );

  fs.writeFileSync(filePath, source, "utf8");
}

// UI Scadenze: pulsante manuale per singola riga, solo admin generale.
{
  const filePath = "src/pages/scadenze/index.tsx";
  let source = fs.readFileSync(filePath, "utf8");

  source = replaceOnce(
    source,
    `    tipo_utente: string;\n  };`,
    `    tipo_utente: string;\n    amministratore_sistema_generale?: boolean;\n  };`,
    "tipo utente admin generale"
  );

  source = replaceOnce(
    source,
    `  const [\n    pagina,\n    setPagina,\n  ] = useState(1);\n\n  const righePerPagina = 25;`,
    `  const [\n    pagina,\n    setPagina,\n  ] = useState(1);\n\n  const [\n    invioAlertInCorsoId,\n    setInvioAlertInCorsoId,\n  ] = useState<string | null>(null);\n\n  const [\n    messaggioInvioAlert,\n    setMessaggioInvioAlert,\n  ] = useState(\"\");\n\n  const righePerPagina = 25;`,
    "state invio alert manuale"
  );

  source = replaceOnce(
    source,
    `  function apriScadenza(\n    scadenza: ScadenzaCentrale\n  ) {\n    if (!scadenza.link_dettaglio) {\n      return;\n    }\n\n    router.push(\n      scadenza.link_dettaglio\n    );\n  }\n\n  const riepilogo =`,
    `  function apriScadenza(\n    scadenza: ScadenzaCentrale\n  ) {\n    if (!scadenza.link_dettaglio) {\n      return;\n    }\n\n    router.push(\n      scadenza.link_dettaglio\n    );\n  }\n\n  async function inviaAlertOra(\n    scadenza: ScadenzaCentrale\n  ) {\n    if (invioAlertInCorsoId) return;\n\n    const conferma = window.confirm(\n      \`Inviare ora l'alert per \"\${scadenza.titolo}\" ai destinatari configurati?\`\n    );\n    if (!conferma) return;\n\n    setInvioAlertInCorsoId(scadenza.id);\n    setMessaggioInvioAlert(\"\");\n    setErrore(\"\");\n\n    try {\n      const supabase = getSupabaseClient();\n      const { data: sessionData, error: sessionError } =\n        await supabase.auth.getSession();\n      if (sessionError) throw sessionError;\n\n      const accessToken = sessionData.session?.access_token;\n      if (!accessToken) {\n        throw new Error(\"Sessione non valida.\");\n      }\n\n      const response = await fetch(\n        \"/api/scadenze-centrale/forza-alert\",\n        {\n          method: \"POST\",\n          headers: {\n            Authorization: \`Bearer \${accessToken}\`,\n            \"Content-Type\": \"application/json\",\n          },\n          body: JSON.stringify({ scadenza_id: scadenza.id }),\n        }\n      );\n\n      const risultato = await response.json().catch(() => ({}));\n      if (!response.ok || !risultato?.success) {\n        throw new Error(\n          risultato?.error || \"Invio alert non riuscito.\"\n        );\n      }\n\n      setMessaggioInvioAlert(\n        \`\${scadenza.titolo}: \${risultato.messaggio || \"operazione completata\"}\`\n      );\n      await caricaScadenze();\n    } catch (error: any) {\n      setErrore(\n        error?.message || \"Errore durante l'invio manuale dell'alert.\"\n      );\n    } finally {\n      setInvioAlertInCorsoId(null);\n    }\n  }\n\n  const riepilogo =`,
    "funzione invio alert manuale"
  );

  source = replaceOnce(
    source,
    `        {errore && (\n          <div style={errorBoxStyle}>`,
    `        {messaggioInvioAlert && (\n          <div style={{ marginBottom: 16, padding: 12, border: \"1px solid #bbf7d0\", borderRadius: 8, background: \"#f0fdf4\", color: \"#166534\", fontWeight: 700 }}>\n            {messaggioInvioAlert}\n          </div>\n        )}\n\n        {errore && (\n          <div style={errorBoxStyle}>`,
    "messaggio esito invio"
  );

  const oldAction = `                          {scadenza.link_dettaglio ? (\n                            <button\n                              type=\"button\"\n                              style={\n                                iconButtonStyle\n                              }\n                              title=\"Apri il modulo di origine\"\n                              onClick={() =>\n                                apriScadenza(\n                                  scadenza\n                                )\n                              }\n                            >\n                              <ExternalLink\n                                size={16}\n                              />\n                            </button>\n                          ) : (\n                            \"—\"\n                          )}`;

  const newAction = `                          <div style={{ display: \"flex\", alignItems: \"center\", justifyContent: \"center\", gap: 6 }}>\n                            {dati?.utente.amministratore_sistema_generale && scadenza.stato_archiviato === \"attiva\" && (\n                              <button\n                                type=\"button\"\n                                style={{ ...iconButtonStyle, width: \"auto\", padding: \"6px 9px\", gap: 5 }}\n                                title=\"Invia alert ora\"\n                                disabled={invioAlertInCorsoId === scadenza.id}\n                                onClick={() => void inviaAlertOra(scadenza)}\n                              >\n                                {invioAlertInCorsoId === scadenza.id ? (\n                                  <Loader2 size={15} className=\"animate-spin\" />\n                                ) : (\n                                  <RefreshCcw size={15} />\n                                )}\n                                <span style={{ fontSize: 11, fontWeight: 800 }}>Invia ora</span>\n                              </button>\n                            )}\n\n                            {scadenza.link_dettaglio ? (\n                              <button\n                                type=\"button\"\n                                style={iconButtonStyle}\n                                title=\"Apri il modulo di origine\"\n                                onClick={() => apriScadenza(scadenza)}\n                              >\n                                <ExternalLink size={16} />\n                              </button>\n                            ) : null}\n                          </div>`;

  source = replaceOnce(source, oldAction, newAction, "azioni riga scadenza");

  fs.writeFileSync(filePath, source, "utf8");
}

console.log("✓ Scadenze: pulsante 'Invia ora' riservato all'amministratore generale applicato");
