import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type ClienteRow = {
  id: string;
  ragione_sociale?: string | null;
  denominazione?: string | null;
  cognome_nome?: string | null;
  nome_cognome?: string | null;
  nome?: string | null;
  cognome?: string | null;
  codice_fiscale?: string | null;
};

type RappresentanteRow = {
  id?: string;
  nome_cognome?: string | null;
  codice_fiscale?: string | null;
  luogo_nascita?: string | null;
  data_nascita?: string | null;
  indirizzo_residenza?: string | null;
  citta_residenza?: string | null;
  cap_residenza?: string | null;
  nazionalita?: string | null;
};

type AV4Row = {
  id: number;
  studio_id?: string | null;
  cliente_id?: string | null;
  av1_id?: number | null;
  rapp_legale_id?: string | null;

  dichiarante_nome_cognome?: string | null;
  dichiarante_codice_fiscale?: string | null;
  dichiarante_luogo_nascita?: string | null;
  dichiarante_data_nascita?: string | null;
  dichiarante_indirizzo_residenza?: string | null;
  dichiarante_citta_residenza?: string | null;
  dichiarante_cap_residenza?: string | null;
  dichiarante_nazionalita?: string | null;

  natura_prestazione?: string | null;

  domanda1?: boolean | null;
  domanda2?: boolean | null;
  domanda3?: boolean | null;
  domanda4?: boolean | null;
  domanda5?: boolean | null;
  spec_domanda5?: string | null;

  domanda6?: boolean | null;
  domanda7?: boolean | null;
  domanda8?: boolean | null;
  domanda9?: boolean | null;

  nome_soc?: string | null;
  sede_legale?: string | null;
  indirizzo_sede?: string | null;
  reg_imprese?: string | null;
  num_reg_imprese?: string | null;
  cod_fiscale_soc?: string | null;

  nome_soc_bis?: string | null;
  sede_legale_bis?: string | null;
  indirizzo_sede_bis?: string | null;
  reg_imprese_bis?: string | null;
  num_reg_imprese_bis?: string | null;
  cod_fiscale_soc_bis?: string | null;
  nome_soc_ter?: string | null;

  domanda10?: boolean | null;
  domanda11?: boolean | null;
  specifica12?: string | null;

  specifica10b?: string | null;
  specifica10c?: string | null;
  specifica11c?: string | null;

  specifica10d?: string | null;
  specifica10e?: string | null;
  specifica10f?: string | null;

  luogo_firma?: string | null;
  data_firma?: string | null;
  luogo_firma_bis?: string | null;
  data_firma_bis?: string | null;

  stato?: string | null;
  versione?: number | null;
};

type TitolareRow = {
  id: number;
  av4_id: number;
  sezione?: string | null;
  nome_cognome?: string | null;
  codice_fiscale?: string | null;
  luogo_nascita?: string | null;
  data_nascita?: string | null;
  indirizzo_residenza?: string | null;
  citta_residenza?: string | null;
  cap_residenza?: string | null;
  nazionalita?: string | null;
};

function formatDate(dateString?: string | null) {
  if (!dateString) return "-";
  const onlyDate = String(dateString).slice(0, 10);
  const [y, m, d] = onlyDate.split("-");
  if (!y || !m || !d) return dateString;
  return `${d}/${m}/${y}`;
}

function buildClienteLabel(row?: ClienteRow | null) {
  if (!row) return "-";

  return (
    row.ragione_sociale ||
    row.denominazione ||
    row.cognome_nome ||
    row.nome_cognome ||
    [row.cognome, row.nome].filter(Boolean).join(" ").trim() ||
    row.id
  );
}

function Checked({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
        value ? "border-black bg-black text-white" : "border-black bg-white text-white"
      }`}
    >
      {value ? "X" : ""}
    </span>
  );
}

function ReadBox({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="border border-black p-3">
      <div className="mb-1 font-semibold">{label}</div>
      <div>{value || "-"}</div>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-[280px] pt-8 text-center">
      <div className="mx-auto mb-2 h-px w-full bg-black" />
      <div className="text-[12px] italic">{label}</div>
    </div>
  );
}

function TitolariTable({
  title,
  rows,
}: {
  title: string;
  rows: TitolareRow[];
}) {
  if (!rows.length) {
    return (
      <div className="border border-black p-3">
        <div className="mb-2 font-semibold">{title}</div>
        <div>-</div>
      </div>
    );
  }

  return (
    <div className="border border-black p-3">
      <div className="mb-3 font-semibold">{title}</div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id || index} className="border border-black p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="font-medium">Nome e cognome: </span>
                {row.nome_cognome || "-"}
              </div>
              <div>
                <span className="font-medium">Codice fiscale: </span>
                {row.codice_fiscale || "-"}
              </div>
              <div>
                <span className="font-medium">Luogo nascita: </span>
                {row.luogo_nascita || "-"}
              </div>
              <div>
                <span className="font-medium">Data nascita: </span>
                {formatDate(row.data_nascita)}
              </div>
              <div>
                <span className="font-medium">Indirizzo residenza: </span>
                {row.indirizzo_residenza || "-"}
              </div>
              <div>
                <span className="font-medium">Città: </span>
                {row.citta_residenza || "-"}
              </div>
              <div>
                <span className="font-medium">CAP: </span>
                {row.cap_residenza || "-"}
              </div>
              <div>
                <span className="font-medium">Nazionalità: </span>
                {row.nazionalita || "-"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StampaAV4Page() {
  const router = useRouter();
  const { id } = router.query;

  const [record, setRecord] = useState<AV4Row | null>(null);
  const [cliente, setCliente] = useState<ClienteRow | null>(null);
  const [rappresentante, setRappresentante] = useState<RappresentanteRow | null>(null);
  const [titolari, setTitolari] = useState<TitolareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const titolari7 = useMemo(
    () => titolari.filter((x) => x.sezione === "domanda7"),
    [titolari]
  );
  const titolari8 = useMemo(
    () => titolari.filter((x) => x.sezione === "domanda8"),
    [titolari]
  );
  const titolari9 = useMemo(
    () => titolari.filter((x) => x.sezione === "domanda9"),
    [titolari]
  );

  useEffect(() => {
    if (!router.isReady || !id) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient() as any;

        const { data: av4Data, error: av4Error } = await supabase
          .from("tbAV4")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (av4Error || !av4Data) {
          setError(av4Error?.message || "Record AV4 non trovato.");
          setLoading(false);
          return;
        }

        setRecord(av4Data as AV4Row);

        if (av4Data.cliente_id) {
          const { data: clienteData } = await supabase
            .from("tbclienti")
            .select("*")
            .eq("id", av4Data.cliente_id)
            .maybeSingle();

          setCliente((clienteData as ClienteRow) || null);
        }

        if (av4Data.rapp_legale_id) {
          const { data: rappData } = await supabase
            .from("rapp_legali")
            .select("*")
            .eq("id", av4Data.rapp_legale_id)
            .maybeSingle();

          setRappresentante((rappData as RappresentanteRow) || null);
        }

        const { data: titolariData } = await supabase
          .from("tbAV4_titolari")
          .select("*")
          .eq("av4_id", id)
          .order("id", { ascending: true });

        setTitolari((titolariData as TitolareRow[]) || []);
      } catch (err: any) {
        setError(err?.message || "Errore caricamento stampa AV4.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router.isReady, id]);

  if (loading) {
    return <div className="p-8">Caricamento stampa AV4...</div>;
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

        html,
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          html,
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden !important;
          }

          #print-area,
          #print-area * {
            visibility: visible !important;
          }

          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .no-print {
            display: none !important;
          }

          .print-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-table-row {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100">
        <div className="no-print mx-auto flex max-w-6xl items-center justify-between p-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded border bg-white px-4 py-2"
          >
            Indietro
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Stampa / Salva PDF
          </button>
        </div>

        <div id="print-area" className="mx-auto max-w-4xl bg-white p-8 text-[12px] leading-5 text-black">
          <div className="mb-6 border-b-2 border-black pb-4 print-section">
            <h1 className="text-2xl font-bold uppercase">AV.4 – Dichiarazione del Cliente</h1>
            <p className="text-sm">Modello di adeguata verifica e dichiarazioni del cliente</p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 print-section">
            <ReadBox label="Cliente" value={buildClienteLabel(cliente)} />
            <ReadBox label="Codice fiscale cliente" value={cliente?.codice_fiscale} />
            <ReadBox label="ID collegato AV1" value={record.av1_id} />
            <ReadBox label="Natura prestazione" value={record.natura_prestazione} />
          </div>

          <div className="mb-6 print-section">
            <h2 className="mb-3 border-b border-black pb-1 text-lg font-bold">
              Dichiarante / rappresentante
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <ReadBox
                label="Cognome e nome"
                value={record.dichiarante_nome_cognome || rappresentante?.nome_cognome}
              />
              <ReadBox
                label="Codice fiscale"
                value={record.dichiarante_codice_fiscale || rappresentante?.codice_fiscale}
              />
              <ReadBox
                label="Luogo di nascita"
                value={record.dichiarante_luogo_nascita || rappresentante?.luogo_nascita}
              />
              <ReadBox
                label="Data di nascita"
                value={formatDate(record.dichiarante_data_nascita || rappresentante?.data_nascita)}
              />
              <ReadBox
                label="Indirizzo residenza"
                value={
                  record.dichiarante_indirizzo_residenza || rappresentante?.indirizzo_residenza
                }
              />
              <ReadBox
                label="Città residenza"
                value={record.dichiarante_citta_residenza || rappresentante?.citta_residenza}
              />
              <ReadBox
                label="CAP residenza"
                value={record.dichiarante_cap_residenza || rappresentante?.cap_residenza}
              />
              <ReadBox
                label="Nazionalità"
                value={record.dichiarante_nazionalita || rappresentante?.nazionalita}
              />
            </div>
          </div>

          <div className="mb-6 print-section">
            <h2 className="mb-3 border-b border-black pb-1 text-lg font-bold">
              Dichiarazioni iniziali
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checked value={Boolean(record.domanda1)} />
                <span>Dati di nascita e residenza come da documento di identificazione allegato</span>
              </div>
              <div className="flex items-start gap-3">
                <Checked value={Boolean(record.domanda2)} />
                <span>Domicilio diverso rispetto al documento di identificazione allegato</span>
              </div>
            </div>
          </div>

          <div className="mb-6 print-section">
            <h2 className="mb-3 border-b border-black pb-1 text-lg font-bold">
              Persona politicamente esposta
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checked value={Boolean(record.domanda3)} />
                <span>Non costituisce persona politicamente esposta</span>
              </div>
              <div className="flex items-start gap-3">
                <Checked value={Boolean(record.domanda4)} />
                <span>Non riveste lo status di PPE da più di un anno</span>
              </div>
              <div className="flex items-start gap-3">
                <Checked value={Boolean(record.domanda5)} />
                <span>Costituisce persona politicamente esposta</span>
              </div>

              {record.domanda5 && (
                <div className="border border-black p-3">
                  <div className="mb-1 font-semibold">Specifica carica pubblica / legame</div>
                  <div>{record.spec_domanda5 || "-"}</div>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6 print-section">
            <h2 className="mb-3 border-b border-black pb-1 text-lg font-bold">
              Titolare effettivo
            </h2>

            <div className="mb-4 space-y-3">
              <div className="flex items-start gap-3">
                <Checked value={Boolean(record.domanda6)} />
                <span>Agisce in proprio</span>
              </div>
              <div className="flex items-start gap-3">
                <Checked value={Boolean(record.domanda7)} />
                <span>Agisce per conto dei seguenti titolari effettivi</span>
              </div>
            </div>

            {record.domanda7 && (
              <div className="mb-4">
                <TitolariTable
                  title="Titolari effettivi - Sezione Domanda 7"
                  rows={titolari7}
                />
              </div>
            )}

            <div className="mb-4 space-y-3">
              <div className="flex items-start gap-3">
                <Checked value={Boolean(record.domanda8)} />
                <span>Agisce per conto della società / ente</span>
              </div>
            </div>

            {record.domanda8 && (
              <div className="mb-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <ReadBox label="Nome società / ente" value={record.nome_soc} />
                  <ReadBox label="Sede legale" value={record.sede_legale} />
                  <ReadBox label="Indirizzo sede" value={record.indirizzo_sede} />
                  <ReadBox label="Registro imprese" value={record.reg_imprese} />
                  <ReadBox label="Numero registro imprese" value={record.num_reg_imprese} />
                  <ReadBox label="Codice fiscale società" value={record.cod_fiscale_soc} />
                </div>

                <TitolariTable
                  title="Titolari effettivi - Sezione Domanda 8"
                  rows={titolari8}
                />
              </div>
            )}

            <div className="mb-4 space-y-3">
              <div className="flex items-start gap-3">
                <Checked value={Boolean(record.domanda9)} />
                <span>
                  Caso residuale ex art. 20, comma 4, agisce per conto della società / ente
                </span>
              </div>
            </div>

            {record.domanda9 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <ReadBox label="Nome società / ente" value={record.nome_soc_bis} />
                  <ReadBox label="Sede legale" value={record.sede_legale_bis} />
                  <ReadBox label="Indirizzo sede" value={record.indirizzo_sede_bis} />
                  <ReadBox label="Registro imprese" value={record.reg_imprese_bis} />
                  <ReadBox label="Numero registro imprese" value={record.num_reg_imprese_bis} />
                  <ReadBox label="Codice fiscale società" value={record.cod_fiscale_soc_bis} />
                  <ReadBox
                    label="Denominazione società ex art. 20, comma 4"
                    value={record.nome_soc_ter}
                  />
                </div>

                <TitolariTable
                  title="Titolari effettivi - Sezione Domanda 9"
                  rows={titolari9}
                />
              </div>
            )}
          </div>

          <div className="mb-6 print-section">
            <h2 className="mb-3 border-b border-black pb-1 text-lg font-bold">
              PPE titolari effettivi
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checked value={Boolean(record.domanda10)} />
                <span>Il/i titolare/i effettivo/i non costituisce/costituiscono PPE</span>
              </div>
              <div className="flex items-start gap-3">
                <Checked value={Boolean(record.domanda11)} />
                <span>Il/i titolare/i effettivo/i costituisce/costituiscono PPE</span>
              </div>
            </div>

            {record.domanda11 && (
              <div className="mt-3 border border-black p-3">
                <div className="mb-1 font-semibold">Specifica PPE titolari effettivi</div>
                <div>{record.specifica12 || "-"}</div>
              </div>
            )}
          </div>

          <div className="mb-6 print-section">
            <h2 className="mb-3 border-b border-black pb-1 text-lg font-bold">
              Informazioni integrative
            </h2>

            <div className="space-y-4">
              <div className="border border-black p-3">
                <div className="mb-1 font-semibold">
                  Relazioni tra cliente e titolare effettivo / esecutore
                </div>
                <div>{record.specifica10b || "-"}</div>
              </div>

              <div className="border border-black p-3">
                <div className="mb-1 font-semibold">Provenienza dei fondi</div>
                <div>{record.specifica10c || "-"}</div>
              </div>

              <div className="border border-black p-3">
                <div className="mb-1 font-semibold">Mezzi di pagamento</div>
                <div>{record.specifica11c || "-"}</div>
              </div>
            </div>
          </div>

          <div className="mb-6 print-section">
            <h2 className="mb-3 border-b border-black pb-1 text-lg font-bold">
              Professione / attività del cliente
            </h2>

            <div className="grid grid-cols-1 gap-4">
              <ReadBox label="Professione / attività" value={record.specifica10d} />
              <ReadBox label="Esercitata / svolta dal" value={record.specifica10e} />
              <ReadBox label="Ambito territoriale" value={record.specifica10f} />
            </div>
          </div>

        <div className="mt-10 border-t border-black pt-6 print-section">
  <div className="grid grid-cols-2 gap-4">
    <ReadBox label="Luogo" value={record.luogo_firma || ""} />
    <ReadBox label="Data" value={formatDate(record.data_firma)} />

    <div className="col-span-2">
      <SignatureLine label="Firma Cliente o Esecutore" />
    </div>

   <div className="col-span-2 whitespace-pre-line text-[10px] leading-4">
  {`Allegato alla Dichiarazione del Cliente

(Nota 1)
Per “riciclaggio” (art. 2, co. 4 e 5, d.lgs. 231/2007) si intende:
a) la conversione o il trasferimento di beni, effettuati essendo a conoscenza che essi provengono da un’attività criminosa o da una partecipazione a tale attività, allo scopo di occultare o dissimulare l’origine illecita dei beni medesimi o di aiutare chiunque sia coinvolto in tale attività a sottrarsi alle conseguenze giuridiche delle proprie azioni;
b) l’occultamento o la dissimulazione della reale natura, provenienza, ubicazione, disposizione, movimento, proprietà dei beni o dei diritti sugli stessi, effettuati essendo a conoscenza che tali beni provengono da un’attività criminosa o da una partecipazione a tale attività;
c) l’acquisto, la detenzione o l’utilizzazione di beni essendo a conoscenza, al momento della loro ricezione, che tali beni provengono da un’attività criminosa o da una partecipazione a tale attività;
d) la partecipazione ad uno degli atti di cui alle lettere a), b) e c) l’associazione per commettere tale atto, il tentativo di perpetrarlo, il fatto di aiutare, istigare o consigliare qualcuno a commetterlo o il fatto di agevolarne l’esecuzione.
Il riciclaggio è considerato tale anche se le attività che hanno generato i beni da riciclare si sono svolte fuori dai confini nazionali. La conoscenza, l’intenzione o la finalità, che debbono costituire un elemento delle azioni di cui al comma 4 possono essere dedotte da circostanze di fatto obiettive.

Per “finanziamento al terrorismo” si intende qualsiasi attività diretta, con ogni mezzo, alla fornitura, alla raccolta, alla provvista, all'intermediazione, al deposito, alla custodia o all'erogazione, in qualunque modo realizzate, di fondi e risorse economiche, direttamente o indirettamente, in tutto o in parte, utilizzabili per il compimento di una o più condotte, con finalità di terrorismo secondo quanto previsto dalle leggi penali ciò indipendentemente dall'effettivo utilizzo dei fondi e delle risorse economiche per la commissione delle condotte anzidette (art. 2, co. 6, d.lgs. 231/2007).

Per “finanziamento dei programmi di proliferazione delle armi di distruzione di massa” si intende la fornitura o la raccolta di fondi e risorse economiche, in qualunque modo realizzata e strumentale, direttamente o indirettamente, a sostenere o favorire tutte quelle attività legate all'ideazione o alla realizzazione di programmi volti a sviluppare strumenti bellici di natura nucleare o chimica o batteriologica (art. 1, lett. e), d.lgs. 109/2007).

(Nota 2) 
Ai sensi dell’art. 55, co. 3, del d.lgs. 231/2007 il soggetto (obbligato, ai sensi della normativa antiriciclaggio, a fornire i dati e le informazioni necessarie ai fini dell'adeguata verifica della clientela) che fornisce dati falsi o informazioni non veritiere, è punito con la reclusione da sei mesi a tre anni e con la multa da 10.000 euro a 30.000 euro, salvo che il fatto costituisca più grave reato.

(Nota 3) 
Per “persone politicamente esposte” (art.1, co. 2, lett. dd), d.lgs. 231/2007), si intendono: le persone fisiche che occupano o hanno cessato di occupare da meno di un anno importanti cariche pubbliche, nonché i loro familiari e coloro che con i predetti soggetti intrattengono notoriamente stretti legami, come di seguito elencate:
1) sono persone fisiche che occupano o hanno occupato importanti cariche pubbliche coloro che ricoprono o hanno ricoperto la carica di: 
1.1 Presidente della Repubblica, Presidente del Consiglio, Ministro, Vice‐Ministro e Sottosegretario, Presidente di Regione, assessore regionale, Sindaco di capoluogo di provincia o città metropolitana, Sindaco di comune con popolazione non inferiore a 15.000 abitanti nonché cariche analoghe in Stati esteri; 
1.2 deputato, senatore, parlamentare europeo, consigliere regionale nonché cariche analoghe in Stati esteri; 
1.3 membro degli organi direttivi centrali di partiti politici; 
1.4 giudice della Corte Costituzionale, magistrato della Corte di Cassazione o della Corte dei conti, consigliere di Stato e altri componenti del Consiglio di Giustizia Amministrativa per la Regione siciliana nonché cariche analoghe in Stati esteri;
1.5 membro degli organi direttivi delle banche centrali e delle autorità indipendenti; 
1.6 ambasciatore, incaricato d'affari ovvero cariche equivalenti in Stati esteri, ufficiale di grado apicale delle forze armate ovvero cariche analoghe in Stati esteri; 
1.7 componente degli organi di amministrazione, direzione o controllo delle imprese controllate, anche indirettamente, dallo Stato italiano o da uno Stato estero ovvero partecipate, in misura prevalente o totalitaria, dalle Regioni, da comuni capoluoghi di provincia e città metropolitane e da comuni con popolazione complessivamente non inferiore a 15.000 abitanti; 
1.8 direttore generale di ASL e di azienda ospedaliera, di azienda ospedaliera universitaria e degli altri enti del servizio sanitario nazionale. 
1.9 direttore, vicedirettore e membro dell'organo di gestione o soggetto svolgenti funzioni equivalenti in organizzazioni internazionali;
2) sono familiari di persone politicamente esposte: i genitori, il coniuge o la persona legata in unione civile o convivenza di fatto o istituti assimilabili alla persona politicamente esposta, i figli e i loro coniugi nonché le persone legate ai figli in unione civile o convivenza di fatto o istituti assimilabili; 
3) sono soggetti con i quali le persone politicamente esposte intrattengono notoriamente stretti legami: 3.1 le persone fisiche che, ai sensi del presente decreto detengono, congiuntamente alla persona politicamente esposta, la titolarità effettiva di enti giuridici, trust e istituti giuridici affini ovvero che intrattengono con la persona politicamente esposta stretti rapporti d’affari; 3.2 le persone fisiche che detengono solo formalmente il controllo totalitario di un’entità notoriamente costituita, di fatto, nell'interesse e a beneficio di una persona politicamente esposta.

(Nota 4) - Per “titolare effettivo” si intende la persona fisica o le persone fisiche, diverse dal cliente, nell'interesse della quale o delle quali, in ultima istanza, il rapporto continuativo è instaurato, la prestazione professionale è resa o l'operazione è eseguita (art. 1, co. 2, lett. pp), d.lgs. 231/2007).
Si indicano di seguito i criteri individuati dalla norma, ai fini della individuazione del titolare effettivo:

Art. 20 del d.lgs.  231/2007 (Criteri per la determinazione della titolarità effettiva di clienti diversi dalle persone fisiche). 
1. Il titolare effettivo di clienti diversi dalle persone fisiche coincide con la persona fisica o le persone fisiche cui, in ultima istanza, è attribuibile la proprietà diretta o indiretta dell'ente ovvero il relativo controllo.
2. Nel caso in cui il cliente sia una società di capitali: a) costituisce indicazione di proprietà diretta la titolarità di una partecipazione superiore al 25 per cento del capitale del cliente, detenuta da una persona fisica; b) costituisce indicazione di proprietà indiretta la titolarità di una percentuale di partecipazioni superiore al 25 per cento del capitale del cliente, posseduto per il tramite di società controllate, società fiduciarie o per interposta persona.
3. Nelle ipotesi in cui l’esame dell'assetto proprietario non consenta di individuare in maniera univoca la persona fisica o le persone fisiche cui è attribuibile la proprietà diretta o indiretta dell’ente, il titolare effettivo coincide con la persona fisica o le persone fisiche cui, in ultima istanza, è attribuibile il controllo del medesimo in forza: a) del controllo della maggioranza dei voti esercitabili in assemblea ordinaria; b) del controllo di voti sufficienti per esercitare un'influenza dominante in assemblea ordinaria; c) dell'esistenza di particolari vincoli contrattuali che consentano di esercitare un’influenza dominante.
4. Nel caso in cui il cliente sia una persona giuridica privata, di cui al decreto del Presidente della Repubblica 10 febbraio 2000, n. 361, sono cumulativamente individuati, come titolari effettivi: a) i fondatori, ove in vita; b) i beneficiari, quando individuati o facilmente individuabili; c) i titolari di funzioni di rappresentanza legale, direzione e amministrazione.
5. Qualora l’applicazione dei criteri di cui ai precedenti commi non consenta di individuare univocamente uno o più titolari effettivi, il titolare effettivo coincide con la persona fisica o le persone fisiche titolari conformemente ai rispettivi assetti organizzativi o statutari, di poteri di rappresentanza legale, amministrazione o direzione della società o del cliente comunque diverso dalla persona fisica.
6. I soggetti obbligati conservano traccia delle verifiche effettuate ai fini dell'individuazione del titolare effettivo nonché, con specifico riferimento al titolare effettivo individuato ai sensi del comma 5, delle ragioni che non hanno consentito di individuare il titolare effettivo ai sensi dei commi 1, 2, 3 e 4 del presente articolo.`}
</div>

    <ReadBox label="Luogo" value={record.luogo_firma_bis || ""} />
    <ReadBox label="Data" value={formatDate(record.data_firma_bis)} />

    <div className="col-span-2">
      <SignatureLine label="Firma Cliente o Esecutore" />
    </div>
  </div>
</div>
        </div>
      </div>
    </>
  );
}
