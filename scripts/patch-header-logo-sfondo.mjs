import fs from "node:fs";

const file = "src/components/Header.tsx";
let source = fs.readFileSync(file, "utf8");

const from = `<img src="/logo-elma.png" alt="Studio Manager Pro" className="h-full w-auto max-w-none object-contain shrink-0" />`;
const to = `<img src="/logo-elma.png" alt="Studio Manager Pro" className="h-full w-auto max-w-none object-contain shrink-0" style={{ mixBlendMode: "multiply" }} />`;

if (!source.includes(to)) {
  if (!source.includes(from)) {
    throw new Error("[header logo] Anchor logo non trovato");
  }
  source = source.replace(from, to);
  fs.writeFileSync(file, source, "utf8");
}

console.log("✓ Header: sfondo bianco logo fuso con il gradiente tramite mix-blend-mode multiply");
