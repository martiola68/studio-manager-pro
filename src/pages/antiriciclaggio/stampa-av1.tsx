import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";

type Cliente = {
  id: string;
  ragione_sociale?: string | null;
  denominazione?: string | null;
  nominativo?: string | null;
  nome?: string | null;
  cognome?: string | null;
  codice_fiscale?: string | null;
};

type AV1Record = {
  id: number | string;
  studio_id?: string | null;
  cliente_id?: string | null;
  Prestazione?: string | null;
  ValRischioIner?: string | null;
  DataVerifica?: string | null;
  ScadenzaVerifica?: string | null;

  A1?: number | null;
  A2?: number | null;
  A3?: number | null;
  A4?: number | null;
  B1?: number | null;
  B2?: number | null;
  B3?: number | null;
  B4?: number | null;
  B5?: number | null;
  B6?: number | null;

  TotA?: number | null;
  TotB?: number | null;
  MediaPunteggio?: number | null;
  LivelloRischio?: string | null;
  RisInerentePonderato?: number | null;
  RisSpecificoPonderato?: number | null;
  RischioEffettivo?: number | null;
  AdeguataVerifica?: string | null;

  [key: string]: any;
};

const sectionTitles: Record<string, string> = {
  A1: "A.1 - Natura giuridica",
  A2: "A.2 - Prevalente attività svolta",
  A3: "A.3 - Comportamento tenuto al momento del conferimento dell’incarico",
  A4: "A.4 - Area geografica di residenza del cliente",
  B1: "B.1 - Tipologia",
  B2: "B.2 - Modalità di svolgimento",
  B3: "B.3 - Ammontare dell’operazione",
  B4: "B.4 - Frequenza e volume delle operazioni/durata della prestazione professionale",
  B5: "B.5 - Ragionevolezza",
  B6: "B.6 - Area geografica di destinazione",
};

const av1Labels = {
  A1: {
    a1a: "Non congruità della natura giuridica prescelta in relazione all’attività svolta e alle sue dimensioni",
    a1b: "Articolazione giuridica, complessità e opacità della struttura volte ad ostacolare l’identificazione del titolare effettivo o l’attività concretamente svolta",
    a1c: "Partecipazione di persone politicamente esposte (cliente, esecutore, titolare effettivo)",
    a1d: "Incarichi in società, associazioni, fondazioni, organizzazioni non lucrative, organizzazioni non governative soprattutto se aventi sede in paesi ad alto rischio o non collaborativi",
    a1e: "Processi penali o indagini in corso per circostanze attinenti al terrorismo, al riciclaggio o all’autoriciclaggio – Misure di prevenzione o provvedimenti di sequestro - Familiarità/stretti legami con soggetti sottoposti a indagini o a procedimenti penali o provvedimenti di sequestro o censiti nelle liste delle persone o degli enti attivi nel finanziamento del terrorismo",
    a1f: "Altro",
  },
  A2: {
    a2a: "Attività esposte al rischio di infiltrazioni criminali e terroristiche secondo le periodiche pubblicazioni delle Autorità in materia, sia a livello sovranazionale (Relazione UE sulla valutazione del rischio sovranazionale), sia a livello nazionale",
    a2b: "Struttura organizzativa e dimensionale non coerente con l’attività svolta",
    a2c: "Non conformità dell’attività svolta rispetto a quella indicata nell’atto costitutivo",
    a2d: "Altro",
  },
  A3: {
    a3a: "Cliente non presente fisicamente",
    a3b: "Presenza di soggetti terzi con ruolo non definito",
    a3c: "Comportamento non trasparente e collaborativo",
    a3d: "Difficoltà nell’individuazione del titolare effettivo",
    a3e: "Altro",
  },
  A4: {
    a4a: "Residenza/localizzazione in: comune italiano a rischio a causa dell’utilizzo eccessivo di contante – Residenza in Paesi terzi ad alto rischio individuati dalle Autorità – Paesi terzi non dotati di efficaci sistemi di prevenzione del riciclaggio e del finanziamento del terrorismo coerenti con le raccomandazioni del GAFI – Paesi terzi caratterizzati da un elevato livello di corruzione o di permeabilità ad altre attività criminose – Aree di conflitto in cui sono presenti organizzazioni terroristiche o in zone limitrofe o di transito – Paese soggetto a sanzioni o embarghi o misure analoghe stabilite dall’O.N.U. o altri organismi internazionali",
    a4b: "Lontananza della residenza del cliente rispetto alla sede del professionista",
    a4c: "Altro",
  },
  B1: {
    b1a: "Operazione ordinaria/straordinaria rispetto al profilo soggettivo del cliente",
    b1b: "Operazione che prevede schemi negoziali che possono agevolare l’opacità delle relazioni economiche e finanziarie intercorrenti tra il cliente e la controparte",
    b1c: "Articolazione contrattuale ingiustificata",
    b1d: "Altro",
  },
  B2: {
    b2a: "Utilizzo di mezzi di pagamento non tracciati - Utilizzo di valute virtuali",
    b2b: "Utilizzo di conti non propri per trasferire/ricevere fondi",
    b2c: "Ricorso reiterato a procure",
    b2d: "Ricorso a domiciliazioni di comodo",
    b2e: "Altro",
  },
  B3: {
    b3a: "Incoerenza dell’ammontare rispetto al profilo economico e finanziario del cliente",
    b3b: "Presenza di frazionamenti artificiosi",
    b3c: "Altro",
  },
  B4: {
    b4a: "Non congruità della frequenza dell’operazione rispetto all’attività esercitata – Operatività improvvisa e poco giustificata rispetto all’ordinaria attività – Operazioni di ammontare consistente, concentrate in un ristretto arco temporale",
    b4b: "Rapporto professionale continuativo o occasionale",
    b4c: "Altro",
  },
  B5: {
    b5a: "Irragionevolezza dell’operazione rispetto all’attività svolta dal cliente",
    b5b: "Irragionevolezza dell’operazione rispetto all’entità delle risorse economiche nella disponibilità del cliente",
    b5c: "Non congruità dell’operazione rispetto alle finalità dichiarate",
    b5d: "Altro",
  },
  B6: {
    b6a: "Destinazione in: comune italiano a rischio a causa dell’utilizzo eccessivo di contante – Paesi terzi ad alto rischio individuati dalle Autorità – Paesi terzi non dotati di efficaci sistemi di prevenzione del riciclaggio e del finanziamento del terrorismo coerenti con le raccomandazioni del GAFI – Paesi terzi caratterizzati da un elevato livello di corruzione o di permeabilità ad altre attività criminose - Aree di conflitto in cui sono presenti organizzazioni terroristiche o in zone limitrofe o di transito - Paese soggetto a sanzioni o embarghi o misure analoghe stabilite dall'O.N.U. o altri organismi internazionali",
    b6b: "Inesistenza di riferimenti tradizionali nell’area geografica di destinazione",
    b6c: "Irragionevolezza e non congruità della ricerca di interazione con altre aree geografiche",
    b6d: "Altro",
  },
} as const;

function formatDate(dateString?: string | null) {
  if (!dateString) return "-";
  const normalized = String(dateString).includes("T")
    ? String(dateString).split("T")[0]
    : String(dateString);

  const [y, m, d] = normalized.split("-");
  if (!y || !m || !d) return normalized;
  return `${d}/${m}/${y}`;
}

function getClienteLabel(cliente?: Cliente | null) {
  if (!cliente) return "-";
  return (
    cliente.ragione_sociale ||
    cliente.denominazione ||
    cliente.nominativo ||
    `${cliente.nome || ""} ${cliente.cognome || ""}`.trim() ||
    cliente.id
  );
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getCategoriaRischio(value: number) {
  if (value <= 1.5) return "non";
  if (value <= 2.5) return "poco";
  if (value <= 3.5) return "abbastanza";
  return "molto";
}

function isActiveMatrixCell(
  row: string,
  col: string,
  categoriaInerente: string,
  categoriaVulnerabilita: string
) {
  return categoriaInerente === row && categoriaVulnerabilita === col;
}

function Checked({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-bold ${
        value ? "bg-black text-white border-black" : "bg-white text-white border-black"
      }`}
    >
      {value ? "X" : ""}
    </span>
  );
}

export default function StampaAV1Page() {
  const router = useRouter();
  const { id } = router.query;

  const [record, setRecord] = useState<AV1Record | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const matrices = useMemo(() => {
    if (!record) return null;

    const TotA =
      record.TotA ??
      (toNumber(record.A1) + toNumber(record.A2) + toNumber(record.A3) + toNumber(record.A4));

    const TotB =
      record.TotB ??
      (toNumber(record.B1) +
        toNumber(record.B2) +
        toNumber(record.B3) +
        toNumber(record.B4) +
        toNumber(record.B5) +
        toNumber(record.B6));

    const MediaPunteggio =
      record.MediaPunteggio ?? Number(((TotA + TotB) / 10).toFixed(2));

    const RisInerentePonderato = toNumber(record.RisInerentePonderato);
    const RisSpecificoPonderato = toNumber(record.RisSpecificoPonderato);
    const RischioEffettivo = toNumber(record.RischioEffettivo);

    const categoriaInerente = getCategoriaRischio(RisInerentePonderato);
    const categoriaVulnerabilita = getCategoriaRischio(MediaPunteggio);

    return {
      TotA,
      TotB,
      MediaPunteggio,
      LivelloRischio: record.LivelloRischio ?? "-",
      RisInerentePonderato,
      RisSpecificoPonderato,
      RischioEffettivo,
      AdeguataVerifica: record.AdeguataVerifica ?? "-",
      categoriaInerente,
      categoriaVulnerabilita,
    };
  }, [record]);

  useEffect(() => {
    if (!router.isReady || !id) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: av1Data, error: av1Error } = await (supabase as any)
        .from("tbAV1")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (av1Error || !av1Data) {
        setError(av1Error?.message || "Record AV1 non trovato.");
        setLoading(false);
        return;
      }

      setRecord(av1Data as AV1Record);

      if (av1Data.cliente_id) {
        const { data: clienteData } = await (supabase as any)
          .from("tbclienti")
          .select("*")
          .eq("id", av1Data.cliente_id)
          .maybeSingle();

        setCliente((clienteData as Cliente) || null);
      }

      setLoading(false);
    };

    load();
  }, [router.isReady, id]);

  if (loading) {
    return <div className="p-8">Caricamento stampa AV1...</div>;
  }

  if (error || !record) {
    return <div className="p-8 text-red-600">Errore: {error || "Record non disponibile."}</div>;
  }

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: #fff !important;
          }

          .print-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100">
        <div className="no-print max-w-6xl mx-auto p-4 flex justify-between items-center">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded border bg-white"
          >
            Indietro
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded bg-blue-600 text-white"
          >
            Stampa / Salva PDF
          </button>
        </div>

        <div className="max-w-4xl mx-auto bg-white p-8 text-[12px] leading-5 text-black">
          <div className="border-b-2 border-black pb-4 mb-6">
            <h1 className="text-2xl font-bold uppercase">Modello AV1</h1>
            <p className="text-sm">Scheda di valutazione del rischio antiriciclaggio</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 print-section">
            <div className="border p-3">
              <div className="font-semibold mb-1">Cliente</div>
              <div>{getClienteLabel(cliente)}</div>
            </div>

            <div className="border p-3">
              <div className="font-semibold mb-1">Codice fiscale</div>
              <div>{cliente?.codice_fiscale || "-"}</div>
            </div>

            <div className="border p-3">
              <div className="font-semibold mb-1">Prestazione</div>
              <div>{record.Prestazione || "-"}</div>
            </div>

            <div className="border p-3">
              <div className="font-semibold mb-1">Valore rischio inerente</div>
              <div>{record.ValRischioIner || "-"}</div>
            </div>

            <div className="border p-3">
              <div className="font-semibold mb-1">Data verifica</div>
              <div>{formatDate(record.DataVerifica)}</div>
            </div>

            <div className="border p-3">
              <div className="font-semibold mb-1">Scadenza verifica</div>
              <div>{formatDate(record.ScadenzaVerifica)}</div>
            </div>
          </div>

          <div className="mb-6 print-section">
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
              A. Aspetti connessi al cliente / B. Aspetti connessi all’operazione
            </h2>

            <div className="space-y-4">
              {Object.entries(av1Labels).map(([sectionKey, fields]) => (
                <div key={sectionKey} className="border p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">{sectionTitles[sectionKey]}</h3>
                    <div>
                      <span className="font-semibold">Valore {sectionKey}: </span>
                      <span>{record[sectionKey] ?? "-"}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(fields).map(([fieldKey, label]) => (
                      <div key={fieldKey} className="flex items-start gap-3">
                        <Checked value={Boolean(record[fieldKey])} />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6 print-section">
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
              Calcoli finali
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="border p-3">
                <div className="font-semibold">TotA</div>
                <div>{matrices?.TotA}</div>
              </div>
              <div className="border p-3">
                <div className="font-semibold">TotB</div>
                <div>{matrices?.TotB}</div>
              </div>
              <div className="border p-3">
                <div className="font-semibold">Media punteggio</div>
                <div>{matrices?.MediaPunteggio}</div>
              </div>
              <div className="border p-3">
                <div className="font-semibold">Livello rischio</div>
                <div>{matrices?.LivelloRischio}</div>
              </div>
              <div className="border p-3">
                <div className="font-semibold">Rischio inerente ponderato</div>
                <div>{matrices?.RisInerentePonderato}</div>
              </div>
              <div className="border p-3">
                <div className="font-semibold">Rischio specifico ponderato</div>
                <div>{matrices?.RisSpecificoPonderato}</div>
              </div>
              <div className="border p-3">
                <div className="font-semibold">Rischio effettivo</div>
                <div>{matrices?.RischioEffettivo}</div>
              </div>
              <div className="border p-3">
                <div className="font-semibold">Adeguata verifica</div>
                <div>{matrices?.AdeguataVerifica}</div>
              </div>
            </div>
          </div>

          <div
            className="mb-6 mt-10 print-section"
            style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
          >
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-4">
              Matrice del rischio
            </h2>

            <div className="overflow-hidden border border-gray-500">
              <div className="grid grid-cols-5">
                <div className="border border-gray-400 p-4 flex items-center justify-center font-bold text-center bg-gray-100">
                  RISCHIO INERENTE 40%
                </div>

                <div className="border border-gray-400 p-3 text-center font-semibold bg-green-200">
                  Non significativo
                  <div className="text-sm font-normal">1 - 1,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-yellow-200">
                  Poco significativo
                  <div className="text-sm font-normal">1,6 - 2,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-orange-300">
                  Abbastanza significativo
                  <div className="text-sm font-normal">2,6 - 3,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-red-400 text-white">
                  Molto significativo
                  <div className="text-sm font-normal">3,6 - 4</div>
                </div>

                <div className="border border-gray-400 p-3 text-center font-semibold bg-red-400 text-white">
                  Molto significativo
                  <div className="text-sm font-normal">3,6 - 4</div>
                </div>
                <div
                  className={`border border-gray-400 h-24 bg-yellow-200 ${
                    isActiveMatrixCell(
                      "molto",
                      "non",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-yellow-200 ${
                    isActiveMatrixCell(
                      "molto",
                      "poco",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-orange-300 ${
                    isActiveMatrixCell(
                      "molto",
                      "abbastanza",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-red-400 ${
                    isActiveMatrixCell(
                      "molto",
                      "molto",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />

                <div className="border border-gray-400 p-3 text-center font-semibold bg-orange-300">
                  Abbastanza significativo
                  <div className="text-sm font-normal">2,6 - 3,5</div>
                </div>
                <div
                  className={`border border-gray-400 h-24 bg-yellow-200 ${
                    isActiveMatrixCell(
                      "abbastanza",
                      "non",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-yellow-200 ${
                    isActiveMatrixCell(
                      "abbastanza",
                      "poco",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-orange-300 ${
                    isActiveMatrixCell(
                      "abbastanza",
                      "abbastanza",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-orange-300 ${
                    isActiveMatrixCell(
                      "abbastanza",
                      "molto",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />

                <div className="border border-gray-400 p-3 text-center font-semibold bg-yellow-200">
                  Poco significativo
                  <div className="text-sm font-normal">1,6 - 2,5</div>
                </div>
                <div
                  className={`border border-gray-400 h-24 bg-green-300 ${
                    isActiveMatrixCell(
                      "poco",
                      "non",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-yellow-200 ${
                    isActiveMatrixCell(
                      "poco",
                      "poco",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-orange-300 ${
                    isActiveMatrixCell(
                      "poco",
                      "abbastanza",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-orange-300 ${
                    isActiveMatrixCell(
                      "poco",
                      "molto",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />

                <div className="border border-gray-400 p-3 text-center font-semibold bg-green-300">
                  Non significativo
                  <div className="text-sm font-normal">1 - 1,5</div>
                </div>
                <div
                  className={`border border-gray-400 h-24 bg-green-300 ${
                    isActiveMatrixCell(
                      "non",
                      "non",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-yellow-200 ${
                    isActiveMatrixCell(
                      "non",
                      "poco",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-yellow-200 ${
                    isActiveMatrixCell(
                      "non",
                      "abbastanza",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
                <div
                  className={`border border-gray-400 h-24 bg-orange-300 ${
                    isActiveMatrixCell(
                      "non",
                      "molto",
                      matrices?.categoriaInerente || "",
                      matrices?.categoriaVulnerabilita || ""
                    )
                      ? "border-4 border-black"
                      : ""
                  }`}
                />
              </div>

              <div className="grid grid-cols-5">
                <div className="border border-gray-400 p-4 bg-gray-100" />
                <div className="border border-gray-400 p-3 text-center font-semibold bg-green-200">
                  Non significativa
                  <div className="text-sm font-normal">1 - 1,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-yellow-200">
                  Poco significativa
                  <div className="text-sm font-normal">1,6 - 2,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-orange-300">
                  Abbastanza significativa
                  <div className="text-sm font-normal">2,6 - 3,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-red-400 text-white">
                  Molto significativa
                  <div className="text-sm font-normal">3,6 - 4</div>
                </div>

                <div className="col-span-5 border border-gray-400 p-4 text-center text-xl font-bold bg-gray-100">
                  VULNERABILITÀ 60%
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm">
              <strong>Rischio inerente ponderato:</strong> {matrices?.RisInerentePonderato}{" "}
              &nbsp; | &nbsp;
              <strong>Vulnerabilità:</strong> {matrices?.MediaPunteggio}
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-black print-section">
            <div className="grid grid-cols-2 gap-10">
              <div>
                <div className="mb-10">Luogo e data: __________________________</div>
              </div>
              <div>
                <div className="mb-10 text-right">
                  Firma professionista: __________________________
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
