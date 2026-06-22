'use client';

import { useMemo, useState } from 'react';
import Head from 'next/head';

type FormData = {
  societa: string;
  codice_fiscale: string;
  anno: string;

  ricavi: number;
  costi_operativi: number;
  ammortamenti: number;
  accantonamenti: number;
  oneri_finanziari: number;
  imposte: number;
  utile_netto: number;

  totale_attivo: number;
  capitale_investito: number;
  patrimonio_netto: number;
  debiti_totali: number;
  attivo_corrente: number;
  passivo_corrente: number;

  cash_flow_operativo: number;
  rate_finanziarie_annue: number;
};

const initialData: FormData = {
  societa: '',
  codice_fiscale: '',
  anno: '',

  ricavi: 0,
  costi_operativi: 0,
  ammortamenti: 0,
  accantonamenti: 0,
  oneri_finanziari: 0,
  imposte: 0,
  utile_netto: 0,

  totale_attivo: 0,
  capitale_investito: 0,
  patrimonio_netto: 0,
  debiti_totali: 0,
  attivo_corrente: 0,
  passivo_corrente: 0,

  cash_flow_operativo: 0,
  rate_finanziarie_annue: 0,
};

function num(value: any) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(2).replace('.', ',')}%`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(2).replace('.', ',');
}

function safeDiv(a: number, b: number) {
  if (!b) return 0;
  return a / b;
}

function getTagValue(xml: Document, names: string[], context = 'Corrente') {
  for (const name of names) {
    const nodes = Array.from(xml.getElementsByTagName('*')).filter((node) => {
      const local = node.localName || node.nodeName.split(':').pop();
      const contextRef = node.getAttribute('contextRef') || '';
      return local === name && contextRef.includes(context);
    });

    if (nodes.length > 0) {
      return num(nodes[0].textContent);
    }
  }

  return 0;
}

function getStringTagValue(xml: Document, names: string[]) {
  for (const name of names) {
    const nodes = Array.from(xml.getElementsByTagName('*')).filter((node) => {
      const local = node.localName || node.nodeName.split(':').pop();
      return local === name;
    });

    if (nodes.length > 0) {
      return String(nodes[0].textContent || '').trim();
    }
  }

  return '';
}

function statoIndicatore(tipo: string, valore: number) {
  if (!Number.isFinite(valore)) return { label: '-', cls: 'bg-slate-100 text-slate-700' };

  if (tipo === 'dscr') {
    if (valore >= 1.2) return { label: 'Buono', cls: 'bg-green-100 text-green-800' };
    if (valore >= 1) return { label: 'Attenzione', cls: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Critico', cls: 'bg-red-100 text-red-800' };
  }

  if (tipo === 'liquidita') {
    if (valore >= 1.5) return { label: 'Buono', cls: 'bg-green-100 text-green-800' };
    if (valore >= 1) return { label: 'Attenzione', cls: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Critico', cls: 'bg-red-100 text-red-800' };
  }

  if (tipo === 'indebitamento') {
    if (valore <= 1.5) return { label: 'Buono', cls: 'bg-green-100 text-green-800' };
    if (valore <= 3) return { label: 'Attenzione', cls: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Critico', cls: 'bg-red-100 text-red-800' };
  }

  if (valore >= 10) return { label: 'Buono', cls: 'bg-green-100 text-green-800' };
  if (valore >= 3) return { label: 'Attenzione', cls: 'bg-yellow-100 text-yellow-800' };
  return { label: 'Critico', cls: 'bg-red-100 text-red-800' };
}

export default function CalcoloIndiciPage() {
  const [form, setForm] = useState<FormData>(initialData);
  const [fileName, setFileName] = useState('');
  const [errore, setErrore] = useState('');

  const risultati = useMemo(() => {
    const ebitda = form.ricavi - form.costi_operativi;
    const ebit = ebitda - form.ammortamenti - form.accantonamenti;
    const ebt = ebit - form.oneri_finanziari;
    const utileNetto = form.utile_netto || ebt - form.imposte;

    return {
      ebitda,
      ebit,
      ebt,
      utileNetto,
      roi: safeDiv(ebit, form.capitale_investito) * 100,
      roe: safeDiv(utileNetto, form.patrimonio_netto) * 100,
      ros: safeDiv(ebit, form.ricavi) * 100,
      roa: safeDiv(utileNetto, form.totale_attivo) * 100,
      indebitamento: safeDiv(form.debiti_totali, form.patrimonio_netto),
      liquidita: safeDiv(form.attivo_corrente, form.passivo_corrente),
      dscr: safeDiv(form.cash_flow_operativo, form.rate_finanziarie_annue),
    };
  }, [form]);

  async function importaXbrl(file: File) {
    setErrore('');
    setFileName(file.name);

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');

      const parserError = xml.getElementsByTagName('parsererror');
      if (parserError.length > 0) {
        throw new Error('File XML/XBRL non leggibile.');
      }

      const societa = getStringTagValue(xml, [
  'DatiAnagraficiDenominazione',
]);

      const codiceFiscale =
        xml.querySelector('identifier')?.textContent?.trim() || '';

      const anno =
        xml.querySelector('context[id*="Corrente"] instant')?.textContent?.slice(0, 4) ||
        xml.querySelector('context[id*="Corrente"] endDate')?.textContent?.slice(0, 4) ||
        '';

      const ricavi = getTagValue(xml, [
        'RicaviVenditePrestazioni',
        'ValoreProduzioneRicaviVenditePrestazioni',
      ]);

      const totaleCostiProduzione = Math.abs(
        getTagValue(xml, ['TotaleCostiProduzione'])
      );

     const ammortamenti = Math.abs(
  getTagValue(xml, [
    'CostiProduzioneAmmortamentiSvalutazioniTotaleAmmortamentiSvalutazioni',
    'TotaleAmmortamentiSvalutazioni',
    'AmmortamentiSvalutazioni',
  ])
);

      const accantonamenti = Math.abs(
        getTagValue(xml, [
          'AccantonamentiPerRischi',
          'AltriAccantonamenti',
        ])
      );

      const oneriFinanziari = Math.abs(
        getTagValue(xml, [
          'InteressiAltriOneriFinanziari',
          'TotaleProventiOneriFinanziari',
        ])
      );

     const imposte = Math.abs(
  getTagValue(xml, [
    'ImposteRedditoEsercizioCorrentiDifferiteAnticipateTotaleImposteRedditoEsercizioCorrentiDifferiteAnticipate',
    'ImposteRedditoEsercizioCorrentiDifferiteAnticipate',
    'TotaleImposteRedditoEsercizioCorrentiDifferiteAnticipate',
  ])
);

      const utileNetto = getTagValue(xml, [
        'UtilePerditaEsercizio',
        'UtilePerditaDellEsercizio',
      ]);

      const totaleAttivo = getTagValue(xml, ['TotaleAttivo']);
      const patrimonioNetto = getTagValue(xml, ['TotalePatrimonioNetto']);
const debitiTotali = getTagValue(xml, ['TotaleDebiti']);
const attivoCorrente = getTagValue(xml, ['TotaleAttivoCircolante']);

const passivoCorrente =
  getTagValue(xml, ['DebitiDebitiVersoBancheEsigibiliEntroEsercizioSuccessivo']) +
  getTagValue(xml, ['DebitiDebitiVersoAltriFinanziatoriEsigibiliEntroEsercizioSuccessivo']) +
  getTagValue(xml, ['DebitiAccontiEsigibiliEntroEsercizioSuccessivo']) +
  getTagValue(xml, ['DebitiDebitiVersoFornitoriEsigibiliEntroEsercizioSuccessivo']) +
  getTagValue(xml, ['DebitiDebitiTributariEsigibiliEntroEsercizioSuccessivo']) +
  getTagValue(xml, ['DebitiDebitiVersoIstitutiPrevidenzaSicurezzaSocialeEsigibiliEntroEsercizioSuccessivo']) +
  getTagValue(xml, ['DebitiAltriDebitiEsigibiliEntroEsercizioSuccessivo']);

      setForm((prev) => ({
        ...prev,
        societa,
        codice_fiscale: codiceFiscale,
        anno,
        ricavi,
        costi_operativi: totaleCostiProduzione,
        ammortamenti,
        accantonamenti,
        oneri_finanziari: oneriFinanziari,
        imposte,
        utile_netto: utileNetto,
        totale_attivo: totaleAttivo,
        patrimonio_netto: patrimonioNetto,
        debiti_totali: debitiTotali,
       attivo_corrente: attivoCorrente,
passivo_corrente: passivoCorrente,
capitale_investito: totaleAttivo - debitiTotali,
      }));
    } catch (err: any) {
      setErrore(err?.message || 'Errore importazione XBRL.');
    }
  }

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: field === 'societa' || field === 'codice_fiscale' || field === 'anno'
        ? value
        : num(value),
    }));
  }

  const indicatori = [
    {
      nome: 'ROI',
      valore: formatPercent(risultati.roi),
      stato: statoIndicatore('percentuale', risultati.roi),
      descrizione: 'Redditività del capitale investito.',
    },
    {
      nome: 'ROE',
      valore: formatPercent(risultati.roe),
      stato: statoIndicatore('percentuale', risultati.roe),
      descrizione: 'Rendimento del patrimonio netto.',
    },
    {
      nome: 'ROS',
      valore: formatPercent(risultati.ros),
      stato: statoIndicatore('percentuale', risultati.ros),
      descrizione: 'Marginalità operativa sui ricavi.',
    },
    {
      nome: 'ROA',
      valore: formatPercent(risultati.roa),
      stato: statoIndicatore('percentuale', risultati.roa),
      descrizione: 'Redditività del totale attivo.',
    },
    {
      nome: 'Indebitamento',
      valore: formatNumber(risultati.indebitamento),
      stato: statoIndicatore('indebitamento', risultati.indebitamento),
      descrizione: 'Rapporto debiti totali / patrimonio netto.',
    },
    {
      nome: 'Liquidità corrente',
      valore: formatNumber(risultati.liquidita),
      stato: statoIndicatore('liquidita', risultati.liquidita),
      descrizione: 'Attivo corrente / passivo corrente.',
    },
    {
      nome: 'DSCR',
      valore: formatNumber(risultati.dscr),
      stato: statoIndicatore('dscr', risultati.dscr),
      descrizione: 'Cash flow operativo / rate finanziarie annue.',
    },
  ];

  async function generaPdf() {
  try {
    const res = await fetch("/api/controllo-gestione/indici-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        form,
        risultati,
        indicatori,
      }),
    });

    if (!res.ok) {
      throw new Error("Errore generazione PDF");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `analisi_indici_${form.anno || "report"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    setErrore(err?.message || "Errore generazione PDF");
  }
}
  
  return (
    <>
      <Head>
        <title>Calcolo indici - Controllo di gestione</title>
      </Head>

      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Calcolo indici economico-finanziari
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Importa un XBRL per precompilare i dati oppure inserisci i valori manualmente.
            </p>
            <button
  type="button"
  onClick={generaPdf}
  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
>
  Genera report PDF
</button>
          </div>

          {errore && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errore}
            </div>
          )}

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Import XBRL</h2>

            <input
              type="file"
              accept=".xml,.xbrl"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importaXbrl(file);
              }}
              className="block w-full rounded-lg border p-2 text-sm"
            />

            {fileName && (
              <p className="mt-2 text-sm text-slate-500">
                File importato: <strong>{fileName}</strong>
              </p>
            )}
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Box title="Dati generali">
              <Input label="Società" value={form.societa} onChange={(v) => updateField('societa', v)} />
              <Input label="Codice fiscale" value={form.codice_fiscale} onChange={(v) => updateField('codice_fiscale', v)} />
              <Input label="Anno" value={form.anno} onChange={(v) => updateField('anno', v)} />
            </Box>

            <Box title="Conto economico">
              <Money label="Ricavi" value={form.ricavi} onChange={(v) => updateField('ricavi', v)} />
              <Money label="Costi operativi" value={form.costi_operativi} onChange={(v) => updateField('costi_operativi', v)} />
              <Money label="Ammortamenti" value={form.ammortamenti} onChange={(v) => updateField('ammortamenti', v)} />
              <Money label="Accantonamenti" value={form.accantonamenti} onChange={(v) => updateField('accantonamenti', v)} />
              <Money label="Oneri finanziari" value={form.oneri_finanziari} onChange={(v) => updateField('oneri_finanziari', v)} />
              <Money label="Imposte" value={form.imposte} onChange={(v) => updateField('imposte', v)} />
              <Money label="Utile netto" value={form.utile_netto} onChange={(v) => updateField('utile_netto', v)} />
            </Box>

            <Box title="Stato patrimoniale">
              <Money label="Totale attivo" value={form.totale_attivo} onChange={(v) => updateField('totale_attivo', v)} />
              <Money label="Capitale investito" value={form.capitale_investito} onChange={(v) => updateField('capitale_investito', v)} />
              <Money label="Patrimonio netto" value={form.patrimonio_netto} onChange={(v) => updateField('patrimonio_netto', v)} />
              <Money label="Debiti totali" value={form.debiti_totali} onChange={(v) => updateField('debiti_totali', v)} />
              <Money label="Attivo corrente" value={form.attivo_corrente} onChange={(v) => updateField('attivo_corrente', v)} />
              <Money label="Passivo corrente" value={form.passivo_corrente} onChange={(v) => updateField('passivo_corrente', v)} />
            </Box>

            <Box title="Dati finanziari manuali">
              <Money
  label="Cash flow operativo"
  value={form.cash_flow_operativo}
  onChange={(v) => updateField("cash_flow_operativo", v)}
  manuale={true}
/>

<Money
  label="Rate finanziarie annue"
  value={form.rate_finanziarie_annue}
  onChange={(v) => updateField("rate_finanziarie_annue", v)}
  manuale={true}
/>
            </Box>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Kpi title="MOL / EBITDA" value={formatEuro(risultati.ebitda)} />
            <Kpi title="EBIT" value={formatEuro(risultati.ebit)} />
            <Kpi title="EBT" value={formatEuro(risultati.ebt)} />
            <Kpi title="Utile netto" value={formatEuro(risultati.utileNetto)} />
          </section>

          <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b p-4">
              <h2 className="text-lg font-semibold">Indicatori</h2>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">Indicatore</th>
                  <th className="px-4 py-3 text-left">Valore</th>
                  <th className="px-4 py-3 text-left">Stato</th>
                  <th className="px-4 py-3 text-left">Descrizione</th>
                </tr>
              </thead>
              <tbody>
                {indicatori.map((item) => (
                  <tr key={item.nome} className="border-t">
                    <td className="px-4 py-3 font-semibold">{item.nome}</td>
                    <td className="px-4 py-3">{item.valore}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.stato.cls}`}>
                        {item.stato.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.descrizione}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </>
  );
}
type BoxProps = {
  title: string;
  children: React.ReactNode;
};

function Box({ title, children }: BoxProps) {
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function Input({ label, value, onChange }: InputProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
     <input
  value={value ?? ""}
  onChange={(e) => onChange(e.target.value)}
  className="
    w-full
    rounded-lg
    border-2
    border-red-300
    bg-red-50
    text-red-700
    font-semibold
    px-3
    py-2
  "
/>
    </label>
  );
}

type MoneyProps = {
  label: string;
  value: number;
  onChange: (value: string) => void;
};

function Money({
  label,
  value,
  onChange,
  manuale = false,
}: MoneyProps & { manuale?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-600">
        {label}
      </span>

      <input
        type="text"
        value={Number(value || 0).toLocaleString("it-IT")}
        onChange={(e) =>
          onChange(
            e.target.value
              .replace(/\./g, "")
              .replace(",", ".")
          )
        }
        className={`
          w-full
          rounded-lg
          border-2
          font-semibold
          px-3
          py-2
          text-right
          ${
            manuale
              ? "border-sky-400 bg-sky-50 text-sky-900"
              : "border-red-300 bg-red-50 text-red-700"
          }
        `}
      />
    </label>
  );
}

type KpiProps = {
  title: string;
  value: string;
};

function Kpi({ title, value }: KpiProps) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
