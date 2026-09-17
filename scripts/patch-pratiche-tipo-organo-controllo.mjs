import fs from "node:fs";

const path = "src/pages/api/pratiche/variazioni/apri-nomina.ts";
let source = fs.readFileSync(path, "utf8");

const oldBlock = `    if (!tipoPraticaId) {\n      return res.status(422).json({\n        success: false,\n        error: \`Nessun tipo pratica attivo compatibile con \${variazione.tipo_variazione}\`,\n      });\n    }`;

const newBlock = `    if (!tipoPraticaId) {\n      const { data: tipoCreato, error: tipoCreateError } = await supabase\n        .from("tbpratiche_tipi")\n        .insert({\n          ente: "CCIAA",\n          nome: "Nomina organo di controllo / revisione",\n          codice: "NOMINA_ORGANO_CONTROLLO",\n          classe_form: "nomina_organo_controllo",\n          attiva: true,\n        })\n        .select("id")\n        .single();\n\n      if (tipoCreateError || !tipoCreato?.id) {\n        throw new Error(\n          tipoCreateError?.message ||\n            \`Impossibile creare il tipo pratica per \${variazione.tipo_variazione}\`\n        );\n      }\n\n      tipoPraticaId = tipoCreato.id;\n\n      const { error: syncError } = await supabase\n        .from("tbpratiche_variazioni_tipi")\n        .update({ tipo_pratica_id: tipoPraticaId })\n        .eq("descrizione_variazione", variazione.tipo_variazione)\n        .eq("attivo", true);\n\n      if (syncError) {\n        console.warn(\n          "Tipo pratica creato ma configurazione variazione non riallineata:",\n          syncError\n        );\n      }\n    }`;

if (!source.includes(newBlock)) {
  if (!source.includes(oldBlock)) {
    throw new Error("[tipo organo controllo] blocco 422 non trovato");
  }
  source = source.replace(oldBlock, newBlock);
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Pratiche: tipo NOMINA_ORGANO_CONTROLLO creato automaticamente se assente");
