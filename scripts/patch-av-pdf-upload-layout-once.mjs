import fs from "node:fs";

const av1Path = "src/pages/antiriciclaggio/modello-av1.tsx";
const av4Path = "src/pages/antiriclaggio/modello-av4.tsx";

let av1 = fs.readFileSync(av1Path, "utf8");
let av4 = fs.readFileSync(av4Path, "utf8");

function replaceRange(source, startNeedle, endNeedle, replacement, label) {
  if (source.includes(replacement)) return source;

  const start = source.indexOf(startNeedle);
  if (start === -1) throw new Error(`Patch AV: inizio blocco non trovato: ${label}`);

  const endStart = source.indexOf(endNeedle, start);
  if (endStart === -1) throw new Error(`Patch AV: fine blocco non trovata: ${label}`);

  const end = endStart + endNeedle.length;
  return source.slice(0, start) + replacement + source.slice(end);
}

// AV4: SOLO layout della card Professione / attività del cliente.
// Nessun file di stampa viene modificato.
const professioneMarker =
  '<div className="font-semibold text-slate-900">Professione / attività del cliente</div>';
const markerIndex = av4.indexOf(professioneMarker);
if (markerIndex === -1) {
  throw new Error('Patch AV4: card "Professione / attività del cliente" non trovata');
}

const gridOld = 'className="grid grid-cols-1 gap-4 md:grid-cols-3"';
const gridNew = 'className="grid grid-cols-1 gap-4"';
const gridIndex = av4.indexOf(gridOld, markerIndex);
if (gridIndex !== -1 && gridIndex - markerIndex < 1000) {
  av4 = av4.slice(0, gridIndex) + gridNew + av4.slice(gridIndex + gridOld.length);
} else {
  const verticalIndex = av4.indexOf(gridNew, markerIndex);
  if (verticalIndex === -1 || verticalIndex - markerIndex >= 1000) {
    throw new Error("Patch AV4: griglia professione non trovata vicino alla card");
  }
}

const av1Replacement = `      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sessione scaduta. Accedi nuovamente e riprova.");
      }

      const signedResponse = await fetch("/api/storage/create-signed-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${session.access_token}\`,
        },
        body: JSON.stringify({ bucket: BUCKET_NAME, path }),
      });

      const signedPayload = await signedResponse.json();

      if (!signedResponse.ok || !signedPayload?.token || !signedPayload?.path) {
        throw new Error(
          signedPayload?.error || "Impossibile preparare il caricamento del PDF."
        );
      }

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .uploadToSignedUrl(signedPayload.path, signedPayload.token, file, {
          contentType: "application/pdf",
        });

      if (error) {
        alert(error.message || "Errore caricamento file firmato.");
        throw error;
      }`;

if (!av1.includes('/api/storage/create-signed-upload')) {
  av1 = replaceRange(
    av1,
    "      const { error } = await supabase.storage",
    "        throw error;\n      }",
    av1Replacement,
    "upload AV1 firmato"
  );
}

const av4Replacement = `    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Sessione scaduta. Accedi nuovamente e riprova.");
      return;
    }

    const signedResponse = await fetch("/api/storage/create-signed-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${session.access_token}\`,
      },
      body: JSON.stringify({
        bucket: "messaggi-allegati",
        path: storagePath,
      }),
    });

    const signedPayload = await signedResponse.json();

    if (!signedResponse.ok || !signedPayload?.token || !signedPayload?.path) {
      console.error("Errore preparazione upload AV4:", signedPayload);
      alert(
        signedPayload?.error || "Impossibile preparare il caricamento del PDF firmato."
      );
      return;
    }

    const { error: uploadError } = await supabase.storage
      .from("messaggi-allegati")
      .uploadToSignedUrl(signedPayload.path, signedPayload.token, file, {
        contentType: "application/pdf",
      });

    if (uploadError) {
      console.error(uploadError);
      alert(uploadError.message || "Errore caricamento PDF firmato.");
      return;
    }`;

if (!av4.includes('/api/storage/create-signed-upload')) {
  av4 = replaceRange(
    av4,
    "    const { error: uploadError } = await supabase.storage",
    "      return;\n    }",
    av4Replacement,
    "upload AV4 firmato"
  );
}

fs.writeFileSync(av1Path, av1, "utf8");
fs.writeFileSync(av4Path, av4, "utf8");
console.log("Patch AV1/AV4 applicata: layout AV4 verticale e upload PDF signed.");
