import fs from "node:fs";

const path = "src/pages/pratiche/modelli.tsx";
let source = fs.readFileSync(path, "utf8");

if (!source.includes('codice: "VERBALE_NOMINA_ORGANO_CONTROLLO"')) {
  const anchor = '  { label: "Modifica/Nomina amministratore/i", value: "nomina_amministratori", codice: "NOMINA_AMMINISTRATORI" },';
  if (!source.includes(anchor)) {
    throw new Error("[modelli organo controllo] anchor tipi pratica non trovato");
  }

  const nuovaVoce = '  { label: "Nomina organo di controllo / revisione", value: "nomina_organo_controllo", codice: "VERBALE_NOMINA_ORGANO_CONTROLLO" },';
  source = source.replace(anchor, `${anchor}\n${nuovaVoce}`);
}

if (!source.includes('"[ORGANI_CONFERMATI]"')) {
  const anchor = '  "[DICHIARAZIONE_CONFORMITA]",';
  if (!source.includes(anchor)) {
    throw new Error("[modelli organo controllo] anchor variabili non trovato");
  }

  const vars = [
    '  "[SOCIETA_DENOMINAZIONE]",',
    '  "[SOCIETA_SEDE]",',
    '  "[SOCIETA_CODICE_FISCALE]",',
    '  "[SOCIETA_PARTITA_IVA]",',
    '  "[SOCIETA_REA]",',
    '  "[DATA_ASSEMBLEA]",',
    '  "[ORA_INIZIO]",',
    '  "[ORA_CHIUSURA]",',
    '  "[LUOGO_ASSEMBLEA]",',
    '  "[PRESIDENTE]",',
    '  "[SEGRETARIO]",',
    '  "[PERCENTUALE_SOCI_PRESENTI]",',
    '  "[DICITURA_PRESENTAZIONE]",',
    '  "[ORGANI_CONFERMATI]",',
    '  "[ORGANI_RIMOSSI]",',
    '  "[NUOVE_NOMINE]",',
    '  "[REVISORI_NOMINATI]",',
    '  "[COMPENSI_ORGANO]",',
  ].join("\n");

  source = source.replace(anchor, `${anchor}\n${vars}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Modelli pratiche: aggiunto Verbale nomina organo di controllo / revisione");
