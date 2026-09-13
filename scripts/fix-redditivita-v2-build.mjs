import fs from "node:fs";

const file = "src/components/controllo-gestione/RedditivitaClientiTab.tsx";
let source = fs.readFileSync(file, "utf8");

const oldButton = '<button type="button" onClick={() => onRipartisci(servizio)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${Math.abs(rip - 100) <= 0.01 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{rip > 0 ? `${rip.toLocaleString("it-IT", { maximumFractionDigits: 2 })}%` : "Assegna"}</button>';
const newOperator = '<span className="text-xs font-semibold text-slate-700">{(() => { const id = servizio.ripartizione?.[0]?.operatore_id; const o = operatori.find((x) => x.id === id); return o ? ([o.nome, o.cognome].filter(Boolean).join(" ") || o.email || "Operatore") : "Nessun operatore associato"; })()}</span>';

if (source.includes(oldButton)) {
  source = source.replace(oldButton, newOperator);
}

// Difesa ulteriore: nessun riferimento manuale deve sopravvivere nel componente v2.
if (source.includes("onRipartisci(servizio)")) {
  throw new Error("Riferimento residuo onRipartisci in RedditivitaClientiTab");
}

fs.writeFileSync(file, source, "utf8");
console.log("✓ Redditivita v2: rimossa assegnazione operatore manuale residua");
