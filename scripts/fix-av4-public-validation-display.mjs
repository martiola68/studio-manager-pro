import fs from "node:fs";

const pagePath = "src/pages/compilazione-av4/[token].tsx";
const titolariPath = "src/components/antiriciclaggio/TitolariEffettiviForm.tsx";

let page = fs.readFileSync(pagePath, "utf8");
let titolari = fs.readFileSync(titolariPath, "utf8");

const validationStart = page.indexOf("  async function validateTitolariPrimaDelSalvataggio() {");
const validationEnd = page.indexOf("\n  async function handleSubmit()", validationStart);

if (validationStart < 0 || validationEnd < 0) {
  throw new Error("[AV4 validation] funzione validateTitolariPrimaDelSalvataggio non trovata");
}

const validationFunction = `  async function validateTitolariPrimaDelSalvataggio() {
    if (!av4Id) return;

    const sezioniDaControllare: Array<"domanda7" | "domanda8" | "domanda9"> = [];

    if (form.domanda7) sezioniDaControllare.push("domanda7");
    if (form.domanda8) sezioniDaControllare.push("domanda8");
    if (form.domanda9) sezioniDaControllare.push("domanda9");

    for (const sezione of sezioniDaControllare) {
      const params = new URLSearchParams({
        token,
        av4_id: av4Id,
        sezione,
      });

      const response = await fetch(
        \`/api/public/av4/titolari?\${params.toString()}\`,
        { cache: "no-store" }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || \`Errore caricamento titolari \${sezione}.\`
        );
      }

      const titolari = Array.isArray(payload?.rows) ? payload.rows : [];

      if (!titolari.length) {
        throw new Error(
          \`Inserire e salvare almeno un titolare effettivo per la sezione \${sezione}.\`
        );
      }

      for (let i = 0; i < titolari.length; i++) {
        const titolare = titolari[i];

        if (!titolare?.codice_fiscale || !String(titolare.codice_fiscale).trim()) {
          throw new Error(
            \`Codice fiscale obbligatorio per il titolare effettivo #\${i + 1} della sezione \${sezione}.\`
          );
        }
      }
    }
  }
`;

page = page.slice(0, validationStart) + validationFunction + page.slice(validationEnd);

// La vista riepilogativa serve esclusivamente alla stampa: non deve comparire nel form web.
titolari = titolari.replaceAll(
  'className="av4-titolari-print"',
  'className="av4-titolari-print hidden"'
);

if (!titolari.includes('className="av4-titolari-print hidden"')) {
  throw new Error("[AV4 validation] riepilogo stampa titolari non trovato");
}

fs.writeFileSync(pagePath, page, "utf8");
fs.writeFileSync(titolariPath, titolari, "utf8");

console.log("AV4 pubblico: validazione titolari via API e riepilogo stampa nascosto a video");
