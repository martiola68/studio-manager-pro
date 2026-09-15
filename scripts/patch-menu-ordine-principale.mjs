import fs from "node:fs";

const path = "src/components/TopNavBar.tsx";
let source = fs.readFileSync(path, "utf8");

// Il ribbon strutturato deve riconoscere il nuovo nome del menu.
source = source.replaceAll('menuLabel === "Studio"', 'menuLabel === "Operatività"');
source = source.replaceAll('["Studio", "Archivi di base", "Revisione e controllo"]', '["Operatività", "Archivi di base", "Revisione e controllo"]');
source = source.replace(
  '      label: "Studio",\n      icon: <BriefcaseBusiness className="h-4 w-4" />',
  '      label: "Operatività",\n      icon: <BriefcaseBusiness className="h-4 w-4" />'
);

const startMarker = "  const menuItems: MenuItem[] = [";
const start = source.indexOf(startMarker);
const end = source.indexOf("\n  ];", start);
if (start < 0 || end < 0) {
  throw new Error("[ordine menu] array menuItems non trovato");
}

const bodyStart = start + startMarker.length;
const body = source.slice(bodyStart, end);

function splitTopLevelObjects(text) {
  const blocks = [];
  let depth = 0;
  let blockStart = -1;
  let quote = null;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) blockStart = i;
      depth += 1;
      continue;
    }

    if (ch === "}") {
      depth -= 1;
      if (depth === 0 && blockStart >= 0) {
        blocks.push(text.slice(blockStart, i + 1));
        blockStart = -1;
      }
    }
  }

  return blocks;
}

const blocks = splitTopLevelObjects(body);
const byLabel = new Map();
for (const block of blocks) {
  const match = block.match(/label:\s*"([^"]+)"/);
  if (match) byLabel.set(match[1], block);
}

const ordine = [
  "Dashboard",
  "Operatività",
  "AML",
  "Revisione e controllo",
  "Pratiche",
  "Contenzioso",
  "Payroll",
  "Archivi di base",
];

for (const label of ordine) {
  if (!byLabel.has(label)) {
    throw new Error(`[ordine menu] voce principale mancante: ${label}`);
  }
}

const extra = Array.from(byLabel.keys()).filter((label) => !ordine.includes(label));
if (extra.length) {
  throw new Error(`[ordine menu] voci principali inattese: ${extra.join(", ")}`);
}

const nuovoBody = `\n    ${ordine.map((label) => byLabel.get(label)).join(",\n    ")}\n`;
source = source.slice(0, bodyStart) + nuovoBody + source.slice(end);

if (source.includes('label: "Studio"')) {
  throw new Error("[ordine menu] etichetta Studio ancora presente come menu");
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Menu principale: Dashboard | Operatività | AML | Revisione e controllo | Pratiche | Contenzioso | Payroll | Archivi di base");
