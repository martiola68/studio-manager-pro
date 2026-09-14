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

const submitStart = page.indexOf("  async function handleSubmit() {");
const submitEnd = page.indexOf("\n  if (loading) {", submitStart);

if (submitStart < 0 || submitEnd < 0) {
  throw new Error("[AV4 validation] funzione handleSubmit non trovata");
}

const submitFunction = `  async function handleSubmit() {
    if (!form.id) {
      alert("AV4 non trovato.");
      return;
    }

    try {
      setSaving(true);

      await validateTitolariPrimaDelSalvataggio();

      const payload = {
        natura_prestazione: form.natura_prestazione || null,

        domanda1: !!form.domanda1,
        domanda2: !!form.domanda2,
        domanda3: !!form.domanda3,
        domanda4: !!form.domanda4,
        domanda5: !!form.domanda5,
        spec_domanda5: form.spec_domanda5 || null,

        domanda6: !!form.domanda6,
        domanda7: !!form.domanda7,
        domanda8: !!form.domanda8,
        domanda9: !!form.domanda9,

        nome_soc: form.nome_soc || null,
        sede_legale: form.sede_legale || null,
        indirizzo_sede: form.indirizzo_sede || null,
        reg_imprese: form.reg_imprese || null,
        num_reg_imprese: form.num_reg_imprese || null,
        cod_fiscale_soc: form.cod_fiscale_soc || null,

        nome_soc_bis: form.nome_soc_bis || null,
        sede_legale_bis: form.sede_legale_bis || null,
        indirizzo_sede_bis: form.indirizzo_sede_bis || null,
        reg_imprese_bis: form.reg_imprese_bis || null,
        num_reg_imprese_bis: form.num_reg_imprese_bis || null,
        cod_fiscale_soc_bis: form.cod_fiscale_soc_bis || null,
        nome_soc_ter: form.nome_soc_ter || null,

        domanda10: !!form.domanda10,
        domanda11: !!form.domanda11,
        specifica12: form.specifica12 || null,

        specifica10b: form.specifica10b || null,
        specifica10c: form.specifica10c || null,
        specifica11c: form.specifica11c || null,
        specifica10d: form.specifica10d || null,
        specifica10e: form.specifica10e || null,
        specifica10f: form.specifica10f || null,

        luogo_firma: form.luogo_firma || null,
        data_firma: form.data_firma || null,
        luogo_firma_bis: form.luogo_firma_bis || null,
        data_firma_bis: form.data_firma_bis || null,
        allegato_pdf_cliente: form.allegato_pdf_cliente || null,
      };

      const response = await fetch("/api/public/av4/salva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          av4_id: form.id,
          payload,
        }),
      });

      const responseData = await response.json();

      if (!response.ok || !responseData?.ok) {
        throw new Error(responseData?.error || "Errore durante il salvataggio.");
      }

      alert("AV4 completato correttamente. Il link non è più riutilizzabile.");
      setNotFound(true);
      return;
    } catch (err: any) {
      console.error("Errore imprevisto salvataggio pubblico:", err);
      alert(err?.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  }
`;

page = page.slice(0, submitStart) + submitFunction + page.slice(submitEnd);

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

console.log("AV4 pubblico: validazione e submit via API, riepilogo stampa nascosto a video");
