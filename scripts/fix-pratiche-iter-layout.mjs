import fs from "node:fs";

const path = "src/pages/pratiche/variazioni.tsx";
let source = fs.readFileSync(path, "utf8");

source = source.replace(
  `<div className="border rounded overflow-hidden bg-white">\n    <table className="w-full text-sm">`,
  `<div className="border rounded overflow-x-auto bg-white">\n    <table className="w-full min-w-[1750px] text-sm">`
);

source = source.replace(
  `<th className="p-2 text-left">Iter</th>`,
  `<th className="p-2 text-left min-w-[300px]">Iter</th>`
);

source = source.replace(
  `<td className="p-2">\n\n  {v.tipo_variazione === "Scioglimento e liquidazione" && (`,
  `<td className="p-2 min-w-[300px] align-top leading-5">\n\n  {v.tipo_variazione === "Scioglimento e liquidazione" && (`
);

source = source.replaceAll(
  `className="space-y-1 text-xs"`,
  `className="space-y-2 text-xs leading-5"`
);

source = source.replaceAll(
  `className="block underline"`,
  `className="block h-auto min-h-0 whitespace-normal underline leading-5 text-left"`
);

source = source.replaceAll(
  `className="block underline text-left"`,
  `className="block h-auto min-h-0 whitespace-normal underline leading-5 text-left"`
);

if (!source.includes(`min-w-[300px] align-top leading-5`)) {
  throw new Error("[iter layout] colonna Iter non aggiornata");
}

if (!source.includes(`overflow-x-auto bg-white`)) {
  throw new Error("[iter layout] contenitore tabella non aggiornato");
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Pratiche: colonna Iter ampliata, interlinea corretta e nessuna sovrapposizione testo");
