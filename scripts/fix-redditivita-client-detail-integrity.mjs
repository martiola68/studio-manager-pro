import fs from "node:fs";

function patch(file, fn) {
  const source = fs.readFileSync(file, "utf8");
  const next = fn(source);
  fs.writeFileSync(file, next, "utf8");
  console.log(`✓ ${file}`);
}

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  source = source.replaceAll(
    'const key = String(r.cliente_servizio_id || "");\n          if (!key || !mappaSettoriCliente.idsAmmessi.has(key)) continue;',
    'const key = String(r.cliente_servizio_id || "");\n          if (!key) continue;'
  );

  if (source.includes("attivitaConListinoFallback")) {
    source = source.replaceAll(
      "const attivitaMap = new Map((attivitaResult.data || []).map((a: any) => [a.id, a]));",
      "const attivitaIdratate = (attivitaResult.data || []).map((a: any) => attivitaConListinoFallback(a));\n        const attivitaMap = new Map(attivitaIdratate.map((a: any) => [a.id, a]));"
    );
    source = source.replaceAll(
      "attivita: attivitaResult.data || [],",
      "attivita: (attivitaResult.data || []).map((a: any) => attivitaConListinoFallback(a)),"
    );
  }

  return source;
});

patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  if (!source.includes('from "@/lib/redditivita-listino"')) {
    source = source.replace(
      'import { Plus, Save, Trash2, X } from "lucide-react";',
      'import { Plus, Save, Trash2, X } from "lucide-react";\nimport { calcolaEconomiaListino, prezzoListinoServizio } from "@/lib/redditivita-listino";'
    );
  }

  const headerRegex = /<tr><th className="px-3 py-3">Area \/ attività<\/th>[\s\S]*?<\/tr>/;
  const header = `<tr>
                    <th className="px-3 py-3">Area / attività</th>
                    <th className="px-3 py-3">Driver</th>
                    <th className="px-3 py-3 text-right">Quantità</th>
                    <th className="px-3 py-3 text-right">Difficoltà</th>
                    <th className="px-3 py-3 text-right">Ore eq.</th>
                    <th className="px-3 py-3 text-right">Costo interno</th>
                    <th className="px-3 py-3 text-right">Listino min–max</th>
                    <th className="px-3 py-3 text-right">Ricavo da difficoltà</th>
                    <th className="px-3 py-3">Operatore</th>
                    <th className="px-3 py-3"></th>
                  </tr>`;
  if (!headerRegex.test(source)) {
    throw new Error("[client-detail-integrity] header tabella servizi non trovato");
  }
  source = source.replace(headerRegex, header);

  source = source.replace(
    /<tr><td colSpan=\{\d+\} className="px-4 py-12 text-center text-slate-400">Nessun servizio configurato per questo cliente\.<\/td><\/tr>/,
    '<tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">Nessun servizio configurato per questo cliente.</td></tr>'
  );

  const serviceRowStart = source.indexOf("function ServiceRow(");
  const summaryStart = source.indexOf("function Summary(", serviceRowStart);
  if (serviceRowStart < 0 || summaryStart < 0) {
    throw new Error("[client-detail-integrity] funzione ServiceRow non trovata");
  }

  const serviceRow = `function ServiceRow({
  servizio,
  operatori,
  onSave,
  onRemove,
}: {
  servizio: Servizio;
  operatori: Operatore[];
  onSave: (s: Servizio, q: number, c: number) => void;
  onRemove: (s: Servizio) => void;
}) {
  const [q, setQ] = useState(n(servizio.quantita_driver));
  const [c, setC] = useState(n(servizio.coefficiente_complessita));

  useEffect(() => {
    setQ(n(servizio.quantita_driver));
    setC(n(servizio.coefficiente_complessita));
  }, [servizio.quantita_driver, servizio.coefficiente_complessita]);

  const tariffa = prezzoListinoServizio(servizio);
  const operatoreId = servizio.ripartizione?.[0]?.operatore_id;
  const operatore = operatori.find((x) => String(x.id) === String(operatoreId || ""));
  const operatoreNome = operatore
    ? ([operatore.nome, operatore.cognome].filter(Boolean).join(" ") || operatore.email || "Operatore")
    : "Nessun operatore associato";

  return (
    <tr>
      <td className="px-3 py-3">
        <div className="font-semibold text-slate-900">{servizio.attivita?.descrizione || "—"}</div>
        <div className="text-xs text-slate-500">{servizio.attivita?.area || ""}</div>
      </td>
      <td className="px-3 py-3 text-slate-600">
        {servizio.attivita?.driver || "—"}
        <div className="text-xs">{servizio.attivita?.unita_misura || ""}</div>
      </td>
      <td className="px-3 py-3 text-right">
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={q || ""}
          onChange={(e) => setQ(Math.max(0, Math.trunc(n(e.target.value))))}
          className="h-9 w-24 rounded-md border border-slate-300 px-2 text-right"
        />
      </td>
      <td className="px-3 py-3 text-right">
        <select
          value={c || 3}
          onChange={(e) => setC(n(e.target.value))}
          className="h-9 min-w-[150px] rounded-md border border-slate-300 bg-white px-2 text-sm"
        >
          <option value={1}>1 · Molto semplice</option>
          <option value={2}>2 · Semplice</option>
          <option value={3}>3 · Ordinaria</option>
          <option value={4}>4 · Complessa</option>
          <option value={5}>5 · Molto complessa</option>
        </select>
      </td>
      <td className="px-3 py-3 text-right font-semibold">
        {n(servizio.ore_equivalenti).toLocaleString("it-IT", { maximumFractionDigits: 2 })}
      </td>
      <td className="px-3 py-3 text-right font-semibold">{euro(servizio.costo_stimato)}</td>
      <td className="px-3 py-3 text-right">
        {tariffa.trovato ? (
          <>
            <div className="font-semibold text-slate-900">{euro(tariffa.minimo)} – {euro(tariffa.massimo)}</div>
            {tariffa.incluso_gruppo && tariffa.gruppo ? (
              <div className="text-[11px] text-slate-500">Gruppo {tariffa.gruppo}</div>
            ) : null}
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right font-semibold text-sky-800">
        {tariffa.trovato ? euro(tariffa.prezzo) : "—"}
      </td>
      <td className="px-3 py-3 text-sm font-semibold text-slate-700">{operatoreNome}</td>
      <td className="whitespace-nowrap px-3 py-3">
        <button
          type="button"
          onClick={() => onSave(servizio, q, c)}
          className="mr-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800"
        >
          Salva
        </button>
        <button
          type="button"
          onClick={() => onRemove(servizio)}
          className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

`;

  source = source.slice(0, serviceRowStart) + serviceRow + source.slice(summaryStart);

  if (!source.includes("operatori={operatori}")) {
    source = source.replaceAll(
      '<ServiceRow key={s.id} servizio={s}',
      '<ServiceRow key={s.id} servizio={s} operatori={operatori}'
    );
  }

  source = source.replaceAll(
    '<Summary label="Costo stimato" value={euro(totali.costo)} />',
    '<Summary label="Costo interno" value={euro(totali.costo)} />'
  );

  if (!source.includes("tariffa.minimo") || !source.includes("tariffa.prezzo")) {
    throw new Error("[client-detail-integrity] rendering listino non applicato");
  }

  return source;
});

console.log("✓ Redditività Clienti: ServiceRow ricostruita con costo, listino, ricavo e operatore");
