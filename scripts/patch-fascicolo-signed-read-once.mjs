import fs from "node:fs";

const file = "src/pages/antiriciclaggio/fascicolo-documenti.tsx";
let source = fs.readFileSync(file, "utf8");

const oldBlock = `      const supabase = getSupabaseClient() as any;\n      const bucketName = doc.bucket_name || "allegati";\n\n      const { data, error } = await supabase.storage\n        .from(bucketName)\n        .createSignedUrl(doc.storage_path, 60);\n\n      if (error) throw error;\n\n      if (!data?.signedUrl) {\n        alert("Impossibile aprire il documento");\n        return;\n      }\n\n   setPreviewUrl(data.signedUrl);`;

const newBlock = `      const supabase = getSupabaseClient() as any;\n      const { data: { session } } = await supabase.auth.getSession();\n\n      if (!session?.access_token) {\n        alert("Sessione non valida. Effettua nuovamente l'accesso.");\n        return;\n      }\n\n      const response = await fetch("/api/antiriciclaggio/fascicolo-documenti/signed-url", {\n        method: "POST",\n        headers: {\n          "Content-Type": "application/json",\n          Authorization: \`Bearer \${session.access_token}\`,\n        },\n        body: JSON.stringify({ documento_id: doc.id }),\n      });\n\n      const payload = await response.json().catch(() => ({}));\n      if (!response.ok || !payload?.signedUrl) {\n        throw new Error(payload?.error || "Impossibile aprire il documento");\n      }\n\n      setPreviewUrl(payload.signedUrl);`;

if (!source.includes(oldBlock)) {
  throw new Error("Blocco handleApriDocumento atteso non trovato");
}

source = source.replace(oldBlock, newBlock);
fs.writeFileSync(file, source);
console.log("Fascicolo signed read patch applied");
// trigger workflow 2026-09-16
