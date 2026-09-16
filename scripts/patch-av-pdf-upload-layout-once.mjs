import fs from "node:fs";

const av1Path = "src/pages/antiriciclaggio/modello-av1.tsx";
const av4Path = "src/pages/antiriclaggio/modello-av4.tsx";

let av1 = fs.readFileSync(av1Path, "utf8");
let av4 = fs.readFileSync(av4Path, "utf8");

function replaceBetween(source, startToken, endToken, replacement, label) {
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`${label}: start token missing`);
  const end = source.indexOf(endToken, start);
  if (end < 0) throw new Error(`${label}: end token missing`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// 1) AV4 UI ONLY: stack the three profession/activity fields vertically.
// Print files are intentionally untouched.
const professionTitle = "Professione / attività del cliente";
const professionStart = av4.indexOf(professionTitle);
if (professionStart < 0) throw new Error("AV4 profession card missing");
const professionWindowEnd = Math.min(av4.length, professionStart + 1200);
const professionWindow = av4.slice(professionStart, professionWindowEnd);
if (professionWindow.includes('grid grid-cols-1 gap-4 md:grid-cols-3')) {
  const changedWindow = professionWindow.replace(
    'grid grid-cols-1 gap-4 md:grid-cols-3',
    'grid grid-cols-1 gap-4'
  );
  av4 = av4.slice(0, professionStart) + changedWindow + av4.slice(professionWindowEnd);
} else if (!professionWindow.includes('grid grid-cols-1 gap-4')) {
  throw new Error("AV4 profession grid missing");
}

// 2) AV1 PDF: browser no longer writes directly to storage.objects.
if (!av1.includes('/api/storage/create-signed-upload')) {
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

  av1 = replaceBetween(
    av1,
    "      const { error } = await supabase.storage",
    "      setFormData((prev) => ({",
    av1Replacement,
    "AV1 upload"
  );
}

// 3) AV4 PDF: same signed-upload flow for the manually signed AV4.
if (!av4.includes('/api/storage/create-signed-upload')) {
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

  av4 = replaceBetween(
    av4,
    "    const { error: uploadError } = await supabase.storage",
    "    const { error: updateError } = await supabase",
    av4Replacement,
    "AV4 upload"
  );
}

fs.writeFileSync(av1Path, av1, "utf8");
fs.writeFileSync(av4Path, av4, "utf8");
console.log("AV patch applied successfully");
