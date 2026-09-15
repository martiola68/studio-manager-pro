import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function write(relativePath, source) {
  fs.writeFileSync(path.join(root, relativePath), source, "utf8");
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) {
    throw new Error(`Anchor non trovato: ${label}`);
  }
  return source.replace(before, after);
}

function patchUtentiPage() {
  const file = "src/pages/impostazioni/utenti.tsx";
  let source = read(file);

  source = replaceRequired(
    source,
    `  utente_comunicazioni: false,\n  amministratore_sistema_generale: false,`,
    `  utente_comunicazioni: false,\n  riceve_alert_scadenze_calendario: true,\n  amministratore_sistema_generale: false,`,
    "utenti formData iniziale"
  );

  source = replaceRequired(
    source,
    `          utente_comunicazioni:\n    formData.utente_comunicazioni,\n} as any);`,
    `          utente_comunicazioni:\n    formData.utente_comunicazioni,\n  riceve_alert_scadenze_calendario:\n    formData.riceve_alert_scadenze_calendario,\n} as any);`,
    "utenti update esistente"
  );

  source = replaceRequired(
    source,
    `    utente_comunicazioni:\n    formData.utente_comunicazioni,\n  }),`,
    `    utente_comunicazioni:\n    formData.utente_comunicazioni,\n    riceve_alert_scadenze_calendario:\n      formData.riceve_alert_scadenze_calendario,\n  }),`,
    "utenti create request"
  );

  source = replaceRequired(
    source,
    `            utente_comunicazioni:\n    formData.utente_comunicazioni,\n          })`,
    `            utente_comunicazioni:\n    formData.utente_comunicazioni,\n            riceve_alert_scadenze_calendario:\n              formData.riceve_alert_scadenze_calendario,\n          })`,
    "utenti update post create"
  );

  source = replaceRequired(
    source,
    `    utente_comunicazioni: Boolean(\n      (utente as any).utente_comunicazioni\n    ),\n    amministratore_sistema_generale: Boolean(`,
    `    utente_comunicazioni: Boolean(\n      (utente as any).utente_comunicazioni\n    ),\n    riceve_alert_scadenze_calendario:\n      (utente as any).riceve_alert_scadenze_calendario !== false,\n    amministratore_sistema_generale: Boolean(`,
    "utenti handleEdit"
  );

  source = replaceRequired(
    source,
    `      utente_comunicazioni: false,\n      amministratore_sistema_generale: false,`,
    `      utente_comunicazioni: false,\n      riceve_alert_scadenze_calendario: true,\n      amministratore_sistema_generale: false,`,
    "utenti reset form"
  );

  source = replaceRequired(
    source,
    `    Utente comunicazioni di Studio\n  </Label>\n</div>\n\n{editingUtente && (`,
    `    Utente comunicazioni di Studio\n  </Label>\n</div>\n\n<div className="flex items-center space-x-2">\n  <Checkbox\n    id="riceve_alert_scadenze_calendario"\n    checked={formData.riceve_alert_scadenze_calendario}\n    onCheckedChange={(checked) =>\n      setFormData((prev) => ({\n        ...prev,\n        riceve_alert_scadenze_calendario: !!checked,\n      }))\n    }\n  />\n\n  <Label\n    htmlFor="riceve_alert_scadenze_calendario"\n    className="cursor-pointer font-medium"\n  >\n    Riceve alert scadenze calendario (con o senza scadenzario)\n  </Label>\n</div>\n\n{editingUtente && (`,
    "utenti checkbox alert calendario"
  );

  write(file, source);
}

function patchUtenteService() {
  const file = "src/services/utenteService.ts";
  let source = read(file);

  source = replaceRequired(
    source,
    `  utente_comunicazioni,\n  amministratore_sistema_generale,`,
    `  utente_comunicazioni,\n  riceve_alert_scadenze_calendario,\n  amministratore_sistema_generale,`,
    "utenteService select flag"
  );

  write(file, source);
}

function patchUpdateUserApi() {
  const file = "src/pages/api/admin/update-user.ts";
  let source = read(file);

  source = replaceRequired(
    source,
    `  "utente_comunicazioni",\n  "amministratore_sistema_generale",`,
    `  "utente_comunicazioni",\n  "riceve_alert_scadenze_calendario",\n  "amministratore_sistema_generale",`,
    "update-user allowlist"
  );

  write(file, source);
}

function patchCreateUserApi() {
  const file = "src/pages/api/auth/create-user.ts";
  let source = read(file);

  source = replaceRequired(
    source,
    `microsoft_connection_id, tipo_rapporto } = req.body;`,
    `microsoft_connection_id, tipo_rapporto, riceve_alert_scadenze_calendario } = req.body;`,
    "create-user body flag"
  );

  source = replaceRequired(
    source,
    `microsoft_connection_id: microsoft_connection_id || null, tipo_rapporto: tipo_rapporto || null };`,
    `microsoft_connection_id: microsoft_connection_id || null, tipo_rapporto: tipo_rapporto || null, riceve_alert_scadenze_calendario: typeof riceve_alert_scadenze_calendario === "boolean" ? riceve_alert_scadenze_calendario : true };`,
    "create-user payload flag"
  );

  write(file, source);
}

function patchProcessaAlert() {
  const file = "src/pages/api/scadenze-centrale/processa-alert.ts";
  let source = read(file);

  source = replaceRequired(
    source,
    `.select("id,nome,cognome,email,studio_id,attivo")`,
    `.select("id,nome,cognome,email,studio_id,attivo,riceve_alert_scadenze_calendario")`,
    "processa-alert select destinatari"
  );

  source = replaceRequired(
    source,
    `        destinatariInterni = (data || []).filter((d) => Boolean(d.email));`,
    `        destinatariInterni = (data || []).filter(\n          (d) => Boolean(d.email) && d.riceve_alert_scadenze_calendario !== false\n        );`,
    "processa-alert filtro flag"
  );

  write(file, source);
}

patchUtentiPage();
patchUtenteService();
patchUpdateUserApi();
patchCreateUserApi();
patchProcessaAlert();

console.log("✓ Utenti: flag ricezione alert scadenze calendario applicato a form, salvataggio e motore invii");
