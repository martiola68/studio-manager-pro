/**
 * Risolve le date email dai medesimi record di tbtipi_scadenze che alimentano
 * Calendario Scadenze. Non utilizza scadenze generiche o date inventate.
 * Il chiamante deve fornire le scadenze attive e visibili al proprio studio
 * (tipoScadenzaService.getAttivi).
 */
export type EmailScadenzaKind =
  | "fiscali_saldo_primo_acconto_cciaa"
  | "fiscali_secondo_acconto"
  | "imu_acconto"
  | "imu_saldo";

export type CalendarDeadline = {
  id?: string;
  nome: string | null;
  tipo_scadenza: string | null;
  data_scadenza: string | null;
  attivo_effettivo?: boolean;
};

type DateResult = {
  dataScadenza: string;
  dataScadenzaMaggiorata: string;
  nomeScadenza: string;
};

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const second = (n: string) =>
  /\b(SECONDO|2|II)\b/.test(n) && /\bACCONTO\b/.test(n);
const first = (n: string) =>
  /\b(PRIMO|1|I)\b/.test(n) && /\bACCONTO\b/.test(n);
const surcharge = (n: string) =>
  /\b(MAGGIORAZIONE|MAGGIORATA|MAGGIORATO|MAGGIORAZ|MAGG|0 40)\b/.test(n);
const isoDate = (value: string | null): string | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, yy, mm, dd] = match;
  const d = new Date(Date.UTC(Number(yy), Number(mm) - 1, Number(dd)));
  return d.getUTCFullYear() === Number(yy) &&
    d.getUTCMonth() + 1 === Number(mm) && d.getUTCDate() === Number(dd)
    ? `${yy}-${mm}-${dd}` : null;
};
const formatIt = (date: string) =>
  `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

export function resolveEmailScadenza(
  rows: CalendarDeadline[],
  kind: EmailScadenzaKind,
  anno: number,
  soggettoIsa?: boolean,
  requiresMaggiorata = false,
): DateResult {
  if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) {
    throw new Error("Anno della scadenza non valido.");
  }
  const fiscal = kind.startsWith("fiscali");
  const candidateRows = rows
    .filter(r => r.attivo_effettivo !== false)
    .filter(r => normalize(r.tipo_scadenza) === (fiscal ? "FISCALE" : "IMU"))
    .map(r => ({ ...r, key: normalize(r.nome), date: isoDate(r.data_scadenza) }))
    .filter(r => r.date?.startsWith(String(anno) + "-"));

  // Non si può usare semplicemente la prima scadenza del settore:
  // nel calendario esistono più tasse con date diverse.
  const score = (name: string, isMaggiorata: boolean): number => {
    if (surcharge(name) !== isMaggiorata) return -1;
    if (fiscal) {
      if (kind === "fiscali_secondo_acconto") {
        if (!second(name)) return -1;
        return 100 + (name.includes("IMPOST") ? 20 : 0);
      }
      if (second(name)) return -1;
      if (/\bNO ISA\b/.test(name) && soggettoIsa === true) return -1;
      if (/\bISA\b/.test(name) && !/\bNO ISA\b/.test(name) && soggettoIsa === false) return -1;
      if (first(name)) return 105 + (name.includes("IMPOST") ? 15 : 0);
      if (/\bSALDO\b/.test(name) && name.includes("IMPOST")) return 100;
      if (name === "IMPOSTE ISA" && soggettoIsa === true) return 115;
      if (name === "IMPOSTE NO ISA" && soggettoIsa === false) return 115;
      if (isMaggiorata && /\b(IMPOST|REDDIT|FISCAL)\w*\b/.test(name)) return 90;
      return -1;
    }
    if (kind === "imu_acconto") {
      if (!/\bACCONTO\b/.test(name) || /\bSALDO\b/.test(name)) return -1;
      return 100 + (name.includes("IMU") ? 10 : 0);
    }
    if (!/\bSALDO\b/.test(name)) return -1;
    return 100 + (name.includes("IMU") ? 10 : 0);
  };

  const choose = (maggiorata: boolean): {date:string;nome:string}|null => {
    const scored = candidateRows.map(r => ({
      date: r.date!, nome: r.nome || "", score: score(r.key, maggiorata),
    })).filter(r => r.score >= 0).sort((a,b) => b.score - a.score);
    if (!scored.length) return null;
    const top = scored.filter(r => r.score === scored[0].score);
    if (new Set(top.map(r => r.date)).size > 1) {
      throw new Error(
        `Calendario Scadenze: trovate più date per ${kind.replaceAll("_"," ")} ${anno}. Correggere le scadenze duplicate prima dell'invio.`
      );
    }
    return top[0];
  };

  const ordinary = choose(false);
  if (!ordinary) {
    throw new Error(
      `Data di pagamento non trovata nel Calendario Scadenze per ${kind.replaceAll("_"," ")} ${anno}. Configurare la scadenza corretta prima di inviare l'F24.`
    );
  }
  const increased = requiresMaggiorata ? choose(true) : null;
  if (requiresMaggiorata && !increased) {
    throw new Error(
      `Nel Calendario Scadenze manca la data con maggiorazione per il primo acconto ${anno}. Registrarla prima di inviare: non viene calcolata automaticamente una data fiscale potenzialmente errata.`
    );
  }
  return {
    dataScadenza: formatIt(ordinary.date),
    dataScadenzaMaggiorata: increased ? formatIt(increased.date) : "",
    nomeScadenza: ordinary.nome,
  };
}
