export type DatevSezione =
  | "SP_ATTIVO"
  | "SP_PASSIVO"
  | "CE_COSTI"
  | "CE_RICAVI";

export type DatevLivello =
  | "macro"
  | "conto"
  | "analitico";

export type RigaContabileDatev = {
  numeroRiga: number;
  sezione: DatevSezione;
  livello: DatevLivello;

  codiceConto: string;
  descrizione: string;
  importo: number;

  codicePadre?: string | null;
};

export type TotaliDatev = {
  totaleAttivita: number;
  totalePassivita: number;

  totaleCosti: number;
  totaleRicavi: number;

  utilePatrimoniale: number;
  utileEconomico: number;
};

export type DatevKoinosParseResult = {
  societa: string;
  codiceAzienda: string;

  periodoDal: string | null;
  periodoAl: string | null;

  righe: RigaContabileDatev[];

  totali: TotaliDatev;

  quadratura: {
    statoPatrimoniale: boolean;
    contoEconomico: boolean;

    differenzaSP: number;
    differenzaCE: number;
  };
};

function parseNumeroItaliano(value: string | undefined): number {
  if (!value) return 0;

  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(normalized);

  return Number.isFinite(numero) ? numero : 0;
}

function normalizeCodice(value: string | undefined): string {
  if (!value) return "";

  return String(value)
    .trim()
    .replace(/\s+/g, "");
}

function normalizeDescrizione(value: string | undefined): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function isCodiceContabile(value: string): boolean {
  if (!value) return false;

  /*
   * DATEV può esportare alcuni codici lunghi in formato scientifico,
   * per esempio:
   *
   * 1,00301E+11
   *
   * quindi non limitiamo il controllo alle sole cifre.
   */
  return /^[0-9]+([,.][0-9]+)?([Ee][+-]?[0-9]+)?$/.test(value);
}

function getLivello(codice: string): DatevLivello {
  /*
   * Nel file DATEV reale:
   *
   * 50, 60, 70, 100, 120...
   *   = conti di raggruppamento
   *
   * 50101020, 60010101510...
   *   = conti analitici
   *
   * Per ora distinguiamo sulla lunghezza.
   * La logica potrà essere affinata senza cambiare il contratto.
   */

  const soloCifre = codice.replace(/\D/g, "");

  if (soloCifre.length <= 3) {
    return "conto";
  }

  return "analitico";
}

function parsePeriodo(
  value: string
): { dal: string | null; al: string | null } {
  const match = value.match(
    /dal\s+(\d{2})\/(\d{2})\/(\d{4})\s+al\s+(\d{2})\/(\d{2})\/(\d{4})/i
  );

  if (!match) {
    return {
      dal: null,
      al: null,
    };
  }

  return {
    dal: `${match[3]}-${match[2]}-${match[1]}`,
    al: `${match[6]}-${match[5]}-${match[4]}`,
  };
}

const MAX_CSV_LINE_LENGTH = 100_000;

function splitCsvLine(line: string): string[] {
  /*
   * Il CSV DATEV utilizza ; come separatore.
   * Alcuni campi possono essere racchiusi tra virgolette.
   */
  if (line.length > MAX_CSV_LINE_LENGTH) {
    throw new Error("Riga CSV DATEV troppo lunga");
  }

  const result: string[] = [];

  let current = "";
  let quoted = false;

  for (let i = 0; i < MAX_CSV_LINE_LENGTH; i++) {
    if (i >= line.length) {
      break;
    }
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }

      continue;
    }

    if (char === ";" && !quoted) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);

  return result;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseDatevKoinosCsv(
  csvText: string
): DatevKoinosParseResult {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);

  const rows = lines.map(splitCsvLine);

  let codiceAzienda = "";
  let societa = "";

  let periodoDal: string | null = null;
  let periodoAl: string | null = null;

  let area:
    | "SP"
    | "CE"
    | null = null;

  const righe: RigaContabileDatev[] = [];

  const totali: TotaliDatev = {
    totaleAttivita: 0,
    totalePassivita: 0,
    totaleCosti: 0,
    totaleRicavi: 0,
    utilePatrimoniale: 0,
    utileEconomico: 0,
  };

  /*
   * Nel file DATEV i codici di raggruppamento ci permettono di
   * associare i conti analitici al proprio padre.
   */
  let ultimoPadreAttivo: string | null = null;
  let ultimoPadrePassivo: string | null = null;
  let ultimoPadreCosti: string | null = null;
  let ultimoPadreRicavi: string | null = null;

  rows.forEach((row, index) => {
    const numeroRiga = index + 1;

    const col0 = normalizeDescrizione(row[0]);
    const col1 = normalizeDescrizione(row[1]);
    const col2 = normalizeCodice(row[2]);
    const col5 = normalizeDescrizione(row[5]);
    const col6 = normalizeDescrizione(row[6]);
    const col7 = normalizeDescrizione(row[7]);

    const col8 = normalizeDescrizione(row[8]);
    const col9 = normalizeCodice(row[9]);
    const col11 = normalizeDescrizione(row[11]);
    const col13 = normalizeDescrizione(row[13]);
    const col15 = normalizeDescrizione(row[15]);

    /*
     * Anagrafica azienda.
     *
     * Esempio reale:
     * 00000462 xxxxxx SRL
     */
    if (
      numeroRiga === 2 &&
      col0
    ) {
      const trimmedCol0 = col0.trim();
      const separatorIndex = trimmedCol0.search(/[ \t]/);

      if (separatorIndex > 0) {
        const possibileCodice = trimmedCol0.slice(0, separatorIndex);
        const possibileSocieta = trimmedCol0.slice(separatorIndex).trim();

        if (/^\d+$/.test(possibileCodice) && possibileSocieta) {
          codiceAzienda = possibileCodice;
          societa = possibileSocieta;
        } else {
          societa = col0;
        }
      } else {
        societa = col0;
      }
    }

    /*
     * Periodo.
     */
    if (/^dal\s+/i.test(col0)) {
      const periodo = parsePeriodo(col0);

      periodoDal = periodo.dal;
      periodoAl = periodo.al;
    }

    /*
     * Cambio sezione.
     */
    if (col0 === "STATO PATRIMONIALE") {
      area = "SP";
      return;
    }

    if (col0 === "CONTO ECONOMICO") {
      area = "CE";
      return;
    }

    /*
     * TOTALI STATO PATRIMONIALE
     */
    if (area === "SP") {
      if (col1 === "TOTALE ATTIVITA'") {
        totali.totaleAttivita =
          parseNumeroItaliano(col6 || col7);
      }

      if (col8 === "TOTALE PASSIVITA'") {
        totali.totalePassivita =
          parseNumeroItaliano(col13 || col15);
      }

      if (col8 === "UTILE D'ESERCIZIO") {
        totali.utilePatrimoniale =
          parseNumeroItaliano(col13 || col15);
      }
    }

    /*
     * TOTALI CONTO ECONOMICO
     */
    if (area === "CE") {
      if (col1 === "TOTALE COSTI") {
        totali.totaleCosti =
          parseNumeroItaliano(col6 || col7);
      }

      if (col8 === "TOTALE RICAVI") {
        totali.totaleRicavi =
          parseNumeroItaliano(col13 || col15);
      }

      if (col1 === "UTILE D'ESERCIZIO") {
        totali.utileEconomico =
          parseNumeroItaliano(col6 || col7);
      }
    }

    /*
     * ==============================
     * LATO SINISTRO
     * ==============================
     *
     * SP → ATTIVO
     * CE → COSTI
     */
    if (
      isCodiceContabile(col2) &&
      col5 &&
      col7
    ) {
      const livello = getLivello(col2);

      const sezione: DatevSezione =
        area === "SP"
          ? "SP_ATTIVO"
          : "CE_COSTI";

      let codicePadre: string | null = null;

      if (livello === "conto") {
        if (sezione === "SP_ATTIVO") {
          ultimoPadreAttivo = col2;
        } else {
          ultimoPadreCosti = col2;
        }
      } else {
        codicePadre =
          sezione === "SP_ATTIVO"
            ? ultimoPadreAttivo
            : ultimoPadreCosti;
      }

      righe.push({
        numeroRiga,
        sezione,
        livello,
        codiceConto: col2,
        descrizione: col5,
        importo: parseNumeroItaliano(col7),
        codicePadre,
      });
    }

    /*
     * ==============================
     * LATO DESTRO
     * ==============================
     *
     * SP → PASSIVO
     * CE → RICAVI
     */
    if (
      isCodiceContabile(col9) &&
      col11 &&
      col15
    ) {
      const livello = getLivello(col9);

      const sezione: DatevSezione =
        area === "SP"
          ? "SP_PASSIVO"
          : "CE_RICAVI";

      let codicePadre: string | null = null;

      if (livello === "conto") {
        if (sezione === "SP_PASSIVO") {
          ultimoPadrePassivo = col9;
        } else {
          ultimoPadreRicavi = col9;
        }
      } else {
        codicePadre =
          sezione === "SP_PASSIVO"
            ? ultimoPadrePassivo
            : ultimoPadreRicavi;
      }

      righe.push({
        numeroRiga,
        sezione,
        livello,
        codiceConto: col9,
        descrizione: col11,
        importo: parseNumeroItaliano(col15),
        codicePadre,
      });
    }
  });

  /*
   * Controllo quadratura SP:
   *
   * Attività =
   * Passività + utile/perdita d'esercizio
   */
  const differenzaSP = round2(
    totali.totaleAttivita -
      (
        totali.totalePassivita +
        totali.utilePatrimoniale
      )
  );

  /*
   * Controllo quadratura CE:
   *
   * Ricavi - Costi = utile/perdita.
   */
  const differenzaCE = round2(
    totali.totaleRicavi -
      totali.totaleCosti -
      totali.utileEconomico
  );

  return {
    societa,
    codiceAzienda,

    periodoDal,
    periodoAl,

    righe,

    totali,

    quadratura: {
      statoPatrimoniale:
        Math.abs(differenzaSP) <= 0.01,

      contoEconomico:
        Math.abs(differenzaCE) <= 0.01,

      differenzaSP,
      differenzaCE,
    },
  };
}
