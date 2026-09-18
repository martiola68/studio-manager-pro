import fs from "node:fs";

const path = "src/app/api/pratiche/[id]/genera-documento/route.ts";
let source = fs.readFileSync(path, "utf8");

source = source.replace(
`    QUALIFICA_TESTO: qualifica ? \` – \${qualifica}\` : "",
    DATA_INIZIO: meta.data_inizio ? formatDataBreveIt(meta.data_inizio) : "",`,
`    QUALIFICA_TESTO: qualifica ? \` – \${qualifica}\` : "",
    LUOGO_NASCITA: meta.nominativo_luogo_nascita || "",
    DATA_NASCITA: meta.nominativo_data_nascita
      ? formatDataBreveIt(meta.nominativo_data_nascita)
      : "",
    DATA_INIZIO: meta.data_inizio ? formatDataBreveIt(meta.data_inizio) : "",`
);

source = source.replace(
`      LUOGO_NASCITA: "",
      DATA_NASCITA: "",`,
`      LUOGO_NASCITA: nuovaCarica.LUOGO_NASCITA || "",
      DATA_NASCITA: nuovaCarica.DATA_NASCITA || "",`
);

if (!source.includes("const accettazionePrincipale =")) {
  const anchor = `    const { data: motivoLiquidazione }`;
  if (!source.includes(anchor)) {
    throw new Error("[accettazione cariche] anchor motivoLiquidazione non trovato");
  }

  source = source.replace(
    anchor,
    `const caricheAccettazione = [...organiConfermati, ...nuoveNomineTutte];
const accettazionePrincipale =
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? caricheAccettazione[0] || null
    : null;

${anchor}`
  );
}

source = source.replace(
`OGGETTO:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? \`Accettazione carica \${caricaDocumento || ""}\`.trim()
    : pratica.titolo || "",`,
`OGGETTO:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.CARICA || caricaDocumento || ""
    : pratica.titolo || "",`
);

source = source.replace(
`TIPO_NOMINA:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? caricaDocumento
    : "",`,
`TIPO_NOMINA:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.CARICA || caricaDocumento || ""
    : "",`
);

source = source.replace(
`      CARICA:
  caricaDocumento,

NOMINATO_NOME:
  nominatoNome,

NOMINATO_CF:
  nominatoCf,

NOMINATO_CITTA_NASCITA:
  nominatoLuogoNascita,

NOMINATO_DATA_NASCITA:
  formatDataBreveIt(nominatoDataNascita),

NOMINATO_INDIRIZZO:
  nominatoIndirizzo,

NOMINATO_CAP:
  nominatoCap,

NOMINATO_CITTA:
  nominatoCitta,

NOMINATO_PROVINCIA:
  nominatoProvincia,`,
`      CARICA:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.CARICA || caricaDocumento
    : caricaDocumento,

NOMINATO_NOME:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.NOME_COGNOME || nominatoNome
    : nominatoNome,

NOMINATO_CF:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.CODICE_FISCALE || nominatoCf
    : nominatoCf,

NOMINATO_CITTA_NASCITA:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.LUOGO_NASCITA || nominatoLuogoNascita
    : nominatoLuogoNascita,

NOMINATO_DATA_NASCITA:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.DATA_NASCITA || formatDataBreveIt(nominatoDataNascita)
    : formatDataBreveIt(nominatoDataNascita),

NOMINATO_INDIRIZZO:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.INDIRIZZO_RESIDENZA || nominatoIndirizzo
    : nominatoIndirizzo,

NOMINATO_CAP:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.CAP_RESIDENZA || nominatoCap
    : nominatoCap,

NOMINATO_CITTA:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.CITTA_RESIDENZA || nominatoCitta
    : nominatoCitta,

NOMINATO_PROVINCIA:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.PROVINCIA_RESIDENZA || nominatoProvincia
    : nominatoProvincia,`
);

source = source.replace(
`DATA_SCADENZA_CARICA:
  datiDocumento.liquidatore_data_scadenza
    ? formatDataIt(datiDocumento.liquidatore_data_scadenza)
    : "",`,
`DATA_SCADENZA_CARICA:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? accettazionePrincipale?.DATA_SCADENZA_CARICA ||
      (datiDocumento.liquidatore_data_scadenza
        ? formatDataIt(datiDocumento.liquidatore_data_scadenza)
        : dataScadenzaCarica)
    : datiDocumento.liquidatore_data_scadenza
    ? formatDataIt(datiDocumento.liquidatore_data_scadenza)
    : "",`
);

if (!source.includes("PROFESSIONISTA_INCARICATO:")) {
  source = source.replace(
`      PROFESSIONISTA_NOME:
        datiDocumento.professionista_nome || "",`,
`      PROFESSIONISTA_NOME:
        datiDocumento.professionista_nome || "",

      PROFESSIONISTA_INCARICATO:
        datiDocumento.professionista_nome || "",`
  );
}

if (!source.includes("CARICHE_ACCETTAZIONE:")) {
  source = source.replace(
`CARICHE:
  cariche,`,
`CARICHE:
  cariche,

CARICHE_ACCETTAZIONE:
  caricheAccettazione,`
  );
}

if (!source.includes("accettazionePrincipale")) {
  throw new Error("[accettazione cariche] variabili principali non applicate");
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Accettazione cariche: variabili complete, anagrafica e durata incarico");
