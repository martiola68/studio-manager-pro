import fs from "node:fs";

const file = "src/pages/clienti/index.tsx";
let source = fs.readFileSync(file, "utf8");

const marker = "// FILTRI UTENTI FISCALE/PAYROLL SEPARATI";

if (source.includes(marker)) {
  console.log("[patch-clienti-filtri-settore] already applied");
  process.exit(0);
}

function replaceOrFail(label, from, to) {
  if (!source.includes(from)) {
    throw new Error(`[patch-clienti-filtri-settore] pattern not found: ${label}`);
  }
  source = source.replace(from, to);
}

replaceOrFail(
  "state ruoli operatori",
  `  const [utenti, setUtenti] = useState<UtenteRow[]>([]);\n  const [cassettiFiscali, setCassettiFiscali] = useState<CassettoFiscaleRow[]>(\n    []\n  );`,
  `  const [utenti, setUtenti] = useState<UtenteRow[]>([]);\n  const [ruoliOperatori, setRuoliOperatori] = useState<\n    Array<{ id: string; ruolo: string | null }>\n  >([]);\n  const [cassettiFiscali, setCassettiFiscali] = useState<CassettoFiscaleRow[]>(\n    []\n  );`
);

replaceOrFail(
  "promise destructuring",
  `    utentiRes,\n    cassettiRes,\n    prestazioniRes,`,
  `    utentiRes,\n    ruoliRes,\n    cassettiRes,\n    prestazioniRes,`
);

replaceOrFail(
  "query ruoli operatori",
  `    supabase\n      .from("tbutenti")\n      .select("*")\n      .order("cognome"),\n\n    supabase\n      .from("tbcassetti_fiscali")`,
  `    supabase\n      .from("tbutenti")\n      .select("*")\n      .order("cognome"),\n\n    supabase\n      .from("tbroperatore")\n      .select("id, ruolo"),\n\n    supabase\n      .from("tbcassetti_fiscali")`
);

replaceOrFail(
  "error ruoli operatori",
  `if (utentiRes.error) throw utentiRes.error;\nif (cassettiRes.error) throw cassettiRes.error;`,
  `if (utentiRes.error) throw utentiRes.error;\nif (ruoliRes.error) throw ruoliRes.error;\nif (cassettiRes.error) throw cassettiRes.error;`
);

replaceOrFail(
  "set ruoli operatori",
  `setContatti(contattiRes.data ?? []);\nsetUtenti(utentiRes.data ?? []);\nsetCassettiFiscali(cassettiRes.data ?? []);`,
  `setContatti(contattiRes.data ?? []);\nsetUtenti(utentiRes.data ?? []);\nsetRuoliOperatori(\n  ((ruoliRes.data ?? []) as Array<{ id: string; ruolo: string | null }>)\n);\nsetCassettiFiscali(cassettiRes.data ?? []);`
);

replaceOrFail(
  "memo filtri utenti",
  `  const loadData = useCallback(async () => {`,
  `  ${marker}\n  const ruoloOperatoreById = useMemo(() => {\n    return new Map(\n      ruoliOperatori.map((r) => [String(r.id), String(r.ruolo || "")])\n    );\n  }, [ruoliOperatori]);\n\n  const utentiFiscaliFiltro = useMemo(() => {\n    return utenti\n      .filter((utente) => {\n        const row = utente as UtenteRow & {\n          ruolo_operatore_id?: string | null;\n          settore?: string | null;\n          tipo_rapporto?: string | null;\n          attivo?: boolean | null;\n        };\n\n        if (row.attivo === false) return false;\n\n        const ruolo = ruoloOperatoreById.get(\n          String(row.ruolo_operatore_id || "")\n        );\n\n        if (ruolo) {\n          const [profiloRaw = "", areeRaw = ""] = ruolo.split("·");\n          const profilo = profiloRaw.trim().toLowerCase();\n          const aree = areeRaw\n            .split("+")\n            .map((area) => area.trim().toLowerCase())\n            .filter(Boolean);\n\n          const profiloAmmesso = [\n            "dipendente",\n            "professionista collaboratore",\n            "professionista socio",\n            "altro",\n          ].includes(profilo);\n\n          return (\n            profiloAmmesso &&\n            aree.includes("contabilità e fiscale") &&\n            !aree.includes("payroll")\n          );\n        }\n\n        const settore = String(row.settore || "").trim().toLowerCase();\n        const rapporto = String(row.tipo_rapporto || "").trim().toLowerCase();\n\n        return (\n          settore === "fiscale" &&\n          ["dipendente", "collaboratore", "socio", "altro"].includes(rapporto)\n        );\n      })\n      .slice()\n      .sort((a, b) =>\n        \`${'${safeString(a.nome)} ${safeString(a.cognome)}'}\`\n          .toLowerCase()\n          .localeCompare(\n            \`${'${safeString(b.nome)} ${safeString(b.cognome)}'}\`.toLowerCase()\n          )\n      );\n  }, [utenti, ruoloOperatoreById]);\n\n  const utentiPayrollFiltro = useMemo(() => {\n    return utenti\n      .filter((utente) => {\n        const row = utente as UtenteRow & {\n          ruolo_operatore_id?: string | null;\n          settore?: string | null;\n          attivo?: boolean | null;\n        };\n\n        if (row.attivo === false) return false;\n\n        const ruolo = ruoloOperatoreById.get(\n          String(row.ruolo_operatore_id || "")\n        );\n\n        if (ruolo) {\n          const [, areeRaw = ""] = ruolo.split("·");\n          const aree = areeRaw\n            .split("+")\n            .map((area) => area.trim().toLowerCase())\n            .filter(Boolean);\n\n          return aree.includes("payroll");\n        }\n\n        return String(row.settore || "").trim().toLowerCase() === "lavoro";\n      })\n      .slice()\n      .sort((a, b) =>\n        \`${'${safeString(a.nome)} ${safeString(a.cognome)}'}\`\n          .toLowerCase()\n          .localeCompare(\n            \`${'${safeString(b.nome)} ${safeString(b.cognome)}'}\`.toLowerCase()\n          )\n      );\n  }, [utenti, ruoloOperatoreById]);\n\n  const loadData = useCallback(async () => {`
);

replaceOrFail(
  "select filtro fiscale",
  `          {utenti\n            .slice()\n            .sort((a, b) =>\n              \`${'${safeString(a.nome)} ${safeString(a.cognome)}'}\`\n                .toLowerCase()\n                .localeCompare(\n                  \`${'${safeString(b.nome)} ${safeString(b.cognome)}'}\`.toLowerCase()\n                )\n            )\n            .map((u) => (`,
  `          {utentiFiscaliFiltro.map((u) => (`
);

const payrollAnchor = `<SelectItem value="all">Tutti (Payroll)</SelectItem>\n          {utenti\n            .slice()\n            .sort((a, b) =>\n              \`${'${safeString(a.nome)} ${safeString(a.cognome)}'}\`\n                .toLowerCase()\n                .localeCompare(\n                  \`${'${safeString(b.nome)} ${safeString(b.cognome)}'}\`.toLowerCase()\n                )\n            )\n            .map((u) => (`;

replaceOrFail(
  "select filtro payroll",
  payrollAnchor,
  `<SelectItem value="all">Tutti (Payroll)</SelectItem>\n          {utentiPayrollFiltro.map((u) => (`
);

fs.writeFileSync(file, source, "utf8");
console.log("[patch-clienti-filtri-settore] applied");
