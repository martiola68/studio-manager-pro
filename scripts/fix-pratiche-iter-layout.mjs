import fs from "node:fs";

const path = "src/pages/pratiche/variazioni.tsx";
let source = fs.readFileSync(path, "utf8");

source = source.replace(
  `<div className="border rounded overflow-hidden bg-white">\n    <table className="w-full text-sm">`,
  `<div className="border rounded overflow-x-auto bg-white">\n    <table className="w-full min-w-[2100px] table-auto text-sm">`
);

source = source.replace(
  `<th className="p-2 text-left">Iter</th>`,
  `<th className="p-2 text-left w-[400px] min-w-[400px]">Iter</th>`
);

source = source.replace(
  `<td className="p-2">\n\n  {v.tipo_variazione === "Scioglimento e liquidazione" && (`,
  `<td className="p-2 w-[400px] min-w-[400px] align-top">\n\n  {v.tipo_variazione === "Scioglimento e liquidazione" && (`
);

source = source.replaceAll(
  `className="space-y-1 text-xs"`,
  `className="space-y-2 text-xs leading-6"`
);

source = source.replaceAll(
  `className="block underline"`,
  `className="block h-auto min-h-0 whitespace-nowrap underline leading-6 text-left"`
);

source = source.replaceAll(
  `className="block underline text-left"`,
  `className="block h-auto min-h-0 whitespace-nowrap underline leading-6 text-left"`
);

source = source.replaceAll(
  `<div>\n        Accettazione:`,
  `<div className="whitespace-nowrap leading-6">\n        Accettazione:`
);
source = source.replaceAll(
  `<div>\n        Accettazione carica/cariche:`,
  `<div className="whitespace-nowrap leading-6">\n        Accettazione carica/cariche:`
);
source = source.replaceAll(
  `<div>\n        Deposito pratica CCIAA:`,
  `<div className="whitespace-nowrap leading-6">\n        Deposito pratica CCIAA:`
);
source = source.replaceAll(
  `<div>\n        Comunicazione AdE:`,
  `<div className="whitespace-nowrap leading-6">\n        Comunicazione AdE:`
);

if (!source.includes(`w-[400px] min-w-[400px] align-top`)) {
  throw new Error("[iter layout] colonna Iter non aggiornata");
}

if (!source.includes(`min-w-[2100px] table-auto`)) {
  throw new Error("[iter layout] tabella non ampliata");
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Pratiche: Iter 400px, step separati, testo leggibile e scroll orizzontale");
