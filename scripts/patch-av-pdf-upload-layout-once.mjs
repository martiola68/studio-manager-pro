import fs from "node:fs";

const av1Path = "src/pages/antiriciclaggio/modello-av1.tsx";
const av4Path = "src/pages/antiriciclaggio/modello-av4.tsx";

let av1 = fs.readFileSync(av1Path, "utf8");
let av4 = fs.readFileSync(av4Path, "utf8");

// AV4 layout: target only the profession/activity card.
const title = "Professione / attività del cliente";
const titlePos = av4.indexOf(title);
if (titlePos >= 0) {
  const oldGrid = 'grid grid-cols-1 gap-4 md:grid-cols-3';
  const gridPos = av4.indexOf(oldGrid, titlePos);
  if (gridPos >= 0 && gridPos - titlePos < 1200) {
    av4 = av4.slice(0, gridPos) + 'grid grid-cols-1 gap-4' + av4.slice(gridPos + oldGrid.length);
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
      }

`;

if (!av1.includes('/api/storage/create-signed-upload')) {
  const startToken = "      const { error } = await supabase.storage";
  const endToken = "      setFormData((prev) => ({";
  const start = av1.indexOf(startToken);
  const end = start >= 0 ? av1.indexOf(endToken, start) : -1;
  if (start < 0 || end <= start) {
    throw new Error("AV1 upload block not found");
  }
  av1 = av1.slice(0, start) + av1Replacement + av1.slice(end);
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
    }

`;

if (!av4.includes('/api/storage/create-signed-upload')) {
  const startToken = "    const { error: uploadError } = await supabase.storage";
  const endToken = "    const { error: updateError } = await supabase";
  const start = av4.indexOf(startToken);
  const end = start >= 0 ? av4.indexOf(endToken, start) : -1;
  if (start < 0 || end <= start) {
    throw new Error("AV4 upload block not found");
  }
  av4 = av4.slice(0, start) + av4Replacement + av4.slice(end);
}

fs.writeFileSync(av1Path, av1, "utf8");
fs.writeFileSync(av4Path, av4, "utf8");
console.log("AV patch applied successfully");
