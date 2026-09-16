import fs from "node:fs";

const av1Path = "src/pages/antiriciclaggio/modello-av1.tsx";
const av4Path = "src/pages/antiriclaggio/modello-av4.tsx";

let av1 = fs.readFileSync(av1Path, "utf8");
let av4 = fs.readFileSync(av4Path, "utf8");

function replaceOnce(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) {
    throw new Error(`Patch AV: blocco non trovato: ${label}`);
  }
  return source.replace(oldValue, newValue);
}

// AV4: modifica SOLO il layout della card "Professione / attività del cliente".
// La stampa non viene toccata.
const professioneMarker =
  '<div className="font-semibold text-slate-900">Professione / attività del cliente</div>';
const markerIndex = av4.indexOf(professioneMarker);
if (markerIndex === -1) {
  throw new Error('Patch AV4: card "Professione / attività del cliente" non trovata');
}

const gridOld = 'className="grid grid-cols-1 gap-4 md:grid-cols-3"';
const gridNew = 'className="grid grid-cols-1 gap-4"';
const gridIndex = av4.indexOf(gridOld, markerIndex);
if (gridIndex !== -1 && gridIndex - markerIndex < 800) {
  av4 = av4.slice(0, gridIndex) + gridNew + av4.slice(gridIndex + gridOld.length);
} else {
  const alreadyVerticalIndex = av4.indexOf(gridNew, markerIndex);
  if (alreadyVerticalIndex === -1 || alreadyVerticalIndex - markerIndex >= 800) {
    throw new Error("Patch AV4: griglia professione non trovata vicino alla card");
  }
}

// AV1: usa un signed upload preparato server-side, così l'upload PDF non dipende
// dalle policy INSERT di storage.objects del browser.
const av1Old = `      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, { upsert: true });

      if (error) {
        alert(error.message || "Errore caricamento file firmato.");
        throw error;
      }`;

const av1New = `      const {
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

av1 = replaceOnce(av1, av1Old, av1New, "upload AV1 firmato");

// AV4: stesso fix per il PDF firmato caricato manualmente.
const av4Old = `    const { error: uploadError } = await supabase.storage
      .from("messaggi-allegati")
      .upload(storagePath, file, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError);
      alert("Errore caricamento PDF firmato.");
      return;
    }`;

const av4New = `    const {
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

av4 = replaceOnce(av4, av4Old, av4New, "upload AV4 firmato");

fs.writeFileSync(av1Path, av1, "utf8");
fs.writeFileSync(av4Path, av4, "utf8");

console.log("Patch AV1/AV4 applicata: layout AV4 verticale e upload PDF signed.");
// trigger workflow after its initial registration on main
