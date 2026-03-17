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
      className={`inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-bold ${
        value ? "bg-black text-white border-black" : "bg-white text-white border-black"
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
    <div className="border p-3">
      <div className="font-semibold mb-1">{label}</div>
      <div>{value || "-"}</div>
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
      <div className="border p-3">
        <div className="font-semibold mb-2">{title}</div>
        <div>-</div>
      </div>
    );
  }

  return (
    <div className="border p-3">
      <div className="font-semibold mb-3">{title}</div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id || index} className="border p-3">
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
            <h1 className="text-2xl font-bold uppercase">AV.4 – Dichiarazione del Cliente</h1>
            <p className="text-sm">
              Modello di adeguata verifica e dichiarazioni del cliente
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 print-section">
            <ReadBox label="Cliente" value={buildClienteLabel(cliente)} />
            <ReadBox label="Codice fiscale cliente" value={cliente?.codice_fiscale} />
            <ReadBox label="ID collegato AV1" value={record.av1_id} />
            <ReadBox label="Natura prestazione" value={record.natura_prestazione} />
          </div>

          <div className="mb-6 print-section">
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
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
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
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
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
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
                <div className="border p-3">
                  <div className="font-semibold mb-1">
                    Specifica carica pubblica / legame
                  </div>
                  <div>{record.spec_domanda5 || "-"}</div>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6 print-section">
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
              Titolare effettivo
            </h2>

            <div className="space-y-3 mb-4">
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

            <div className="space-y-3 mb-4">
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

            <div className="space-y-3 mb-4">
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
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
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
              <div className="border p-3 mt-3">
                <div className="font-semibold mb-1">Specifica PPE titolari effettivi</div>
                <div>{record.specifica12 || "-"}</div>
              </div>
            )}
          </div>

          <div className="mb-6 print-section">
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
              Informazioni integrative
            </h2>

            <div className="space-y-4">
              <div className="border p-3">
                <div className="font-semibold mb-1">
                  Relazioni tra cliente e titolare effettivo / esecutore
                </div>
                <div>{record.specifica10b || "-"}</div>
              </div>

              <div className="border p-3">
                <div className="font-semibold mb-1">Provenienza dei fondi</div>
                <div>{record.specifica10c || "-"}</div>
              </div>

              <div className="border p-3">
                <div className="font-semibold mb-1">Mezzi di pagamento</div>
                <div>{record.specifica11c || "-"}</div>
              </div>
            </div>
          </div>

          <div className="mb-6 print-section">
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
              Professione / attività del cliente
            </h2>

            <div className="grid grid-cols-1 gap-4">
              <ReadBox label="Professione / attività" value={record.specifica10d} />
              <ReadBox label="Esercitata / svolta dal" value={record.specifica10e} />
              <ReadBox label="Ambito territoriale" value={record.specifica10f} />
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-black print-section">
            <div className="grid grid-cols-2 gap-10">
              <div>
                <div className="mb-3">
                  Luogo e data: {record.luogo_firma || "________________"}{" "}
                  {record.data_firma ? `- ${formatDate(record.data_firma)}` : ""}
                </div>
                <div className="mt-10">Firma cliente / dichiarante: __________________________</div>
              </div>

              <div>
                <div className="mb-3">
                  Luogo e data: {record.luogo_firma_bis || "________________"}{" "}
                  {record.data_firma_bis ? `- ${formatDate(record.data_firma_bis)}` : ""}
                </div>
                <div className="mt-10">Firma professionista: __________________________</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
