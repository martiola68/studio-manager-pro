import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { AV2_CHECKLIST } from "@/config/av2Checklist";

type Cliente = {
  id: string;
  cod_cliente?: string | null;
  ragione_sociale?: string | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
};

type AV2Row = {
  id: string;
  studio_id?: string | null;
  cliente_id?: string | null;
  av1_id?: number | null;
  data_check?: string | null;
  firma_check?: string | null;
  [key: string]: any;
};

function normalizeDateValue(value: unknown) {
  if (!value) return "";
  const str = String(value);
  return str.includes("T") ? str.split("T")[0] : str;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const normalized = normalizeDateValue(value);
  const [y, m, d] = normalized.split("-");
  if (!y || !m || !d) return normalized;
  return `${d}/${m}/${y}`;
}

function getClienteLabel(cliente?: Cliente | null) {
  if (!cliente) return "-";
  return cliente.ragione_sociale || cliente.cod_cliente || cliente.id;
}

export default function StampaAV2Page() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<AV2Row | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady || !id || typeof id !== "string") return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: av2Data, error: av2Error } = await (supabase as any)
          .from("tbAV2")
          .select("*")
          .eq("id", id)
          .single();

        if (av2Error) {
          setError(av2Error.message);
          return;
        }

        setRow(av2Data);

        if (av2Data?.cliente_id) {
          const { data: clienteData, error: clienteError } = await (supabase as any)
            .from("tbclienti")
            .select("id, cod_cliente, ragione_sociale, codice_fiscale, partita_iva")
            .eq("id", av2Data.cliente_id)
            .single();

          if (clienteError) {
            console.error("Errore caricamento cliente:", clienteError);
          } else {
            setCliente(clienteData || null);
          }
        }
      } catch (err: any) {
        console.error("Errore stampa AV2:", err);
        setError(err?.message || "Errore durante il caricamento stampa AV2.");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [router.isReady, id]);

  if (loading) {
    return <div className="p-8">Caricamento stampa AV2...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Errore: {error}</div>;
  }

  if (!row) {
    return <div className="p-8">Record AV2 non trovato.</div>;
  }

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .no-print,
          header,
          nav,
          aside,
          [role="navigation"],
          [data-no-print="true"] {
            display: none !important;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body * {
            visibility: hidden;
          }

          #print-area,
          #print-area * {
            visibility: visible;
          }

          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .print-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .bg-gray-100 {
            background-color: #f3f4f6 !important;
          }

          .border-gray-200,
          .border-gray-300,
          .border-gray-400 {
            border-color: #9ca3af !important;
          }

          .text-gray-700 {
            color: #374151 !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100 text-black">
        <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h1 className="text-xl font-bold">Stampa AV2</h1>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Stampa / PDF
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded border px-4 py-2 hover:bg-gray-50"
            >
              Chiudi
            </button>
          </div>
        </div>

        <div
          id="print-area"
          className="mx-auto max-w-7xl bg-white p-8 text-[12px] leading-5 text-black"
        >
          <div className="mb-8 border-b-2 border-black pb-4 text-center">
            <h1 className="text-2xl font-bold uppercase">
              AV.2 – CHECK-LIST AI FINI DELLA FORMAZIONE DEL FASCICOLO DEL CLIENTE
            </h1>
          </div>

          <div className="print-break-inside-avoid mb-6 rounded border p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">Cliente:</span>{" "}
                {getClienteLabel(cliente)}
              </div>
              <div>
                <span className="font-semibold">Codice fiscale:</span>{" "}
                {cliente?.codice_fiscale || "-"}
              </div>
              <div>
                <span className="font-semibold">Data check:</span>{" "}
                {formatDate(row.data_check)}
              </div>
              <div>
                <span className="font-semibold">Firma check:</span>{" "}
                {row.firma_check || "-"}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded border">
            <div className="grid grid-cols-12 gap-3 border-b bg-gray-100 px-4 py-3 text-xs font-bold">
              <div className="col-span-1 text-center">X</div>
              <div className="col-span-3">DOCUMENTAZIONE</div>
              <div className="col-span-4">OSSERVAZIONI</div>
              <div className="col-span-4">ANNOTAZIONI PROFESSIONISTA</div>
            </div>

            {AV2_CHECKLIST.map((item) => (
              <div
                key={item.id}
                className="print-break-inside-avoid grid grid-cols-12 gap-3 border-b px-4 py-4 text-xs"
              >
                <div className="col-span-1 flex justify-center pt-1">
                  <div className="flex h-5 w-5 items-center justify-center border border-black text-[10px] font-bold">
                    {row[`spunta${item.id}`] ? "X" : ""}
                  </div>
                </div>

                <div className="col-span-3 whitespace-pre-line">
                  {item.documento}
                </div>

                <div className="col-span-4 whitespace-pre-line text-gray-700">
                  {item.osservazioni || "-"}
                </div>

                <div className="col-span-4 whitespace-pre-line rounded border p-2">
                  {row[`annotazioni${item.id}`] || ""}
                </div>
              </div>
            ))}
          </div>

          <div className="print-break-inside-avoid mt-8 grid grid-cols-2 gap-8 text-sm">
            <div>
              <div className="mb-2 font-semibold">Data</div>
              <div className="min-h-[40px] border-b border-black">
                {formatDate(row.data_check)}
              </div>
            </div>

            <div>
              <div className="mb-2 font-semibold">Firma</div>
              <div className="min-h-[40px] border-b border-black">
                {row.firma_check || ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
