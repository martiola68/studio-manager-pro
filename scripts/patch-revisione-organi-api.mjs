import fs from "node:fs";

const path = "src/pages/revisione-controllo/presa-in-carico.tsx";
let source = fs.readFileSync(path, "utf8");

const oldSnapshot = `  async function caricaSnapshot() {
    setLoadingSnapshot(true); setErrore("");
    const supabase = getSupabaseClient() as any;
    const [clienteRes, organiRes] = await Promise.all([supabase.from("tbclienti").select("*").eq("id", clienteId).maybeSingle(), supabase.from("tbclienti_organi").select("*").eq("cliente_id", clienteId)]);
    if (clienteRes.error) { setErrore(clienteRes.error.message); setLoadingSnapshot(false); return; }
    if (organiRes.error) { setErrore(organiRes.error.message); setLoadingSnapshot(false); return; }
    setSnapshot({ acquisito_il: new Date().toISOString(), cliente: clienteRes.data || null, organi_sociali: organiRes.data || [] }); setLoadingSnapshot(false);
  }
`;

const newSnapshot = `  async function caricaSnapshot() {
    setLoadingSnapshot(true); setErrore("");
    const supabase = getSupabaseClient() as any;

    try {
      const [clienteRes, organiResponse] = await Promise.all([
        supabase.from("tbclienti").select("*").eq("id", clienteId).maybeSingle(),
        fetch(\`/api/clienti-organi?cliente_id=\${encodeURIComponent(clienteId)}\`, { cache: "no-store" }),
      ]);

      if (clienteRes.error) throw new Error(clienteRes.error.message);
      const organiPayload = await organiResponse.json();
      if (!organiResponse.ok) {
        throw new Error(organiPayload?.error || "Errore nel caricamento di soci e organi sociali.");
      }

      setSnapshot({
        acquisito_il: new Date().toISOString(),
        cliente: clienteRes.data || null,
        organi_sociali: Array.isArray(organiPayload?.organi) ? organiPayload.organi : [],
      });
    } catch (e: any) {
      setSnapshot(null);
      setErrore(e?.message || "Errore durante l'acquisizione dei dati societari.");
    } finally {
      setLoadingSnapshot(false);
    }
  }
`;

const oldRoles = `  const organiAllaData = (snapshot?.organi_sociali || []).filter((o: any) => organoValidoAllaData(o, dataBilancio));
  const soci = organiAllaData.filter((o: any) => o.ruolo === "socio");
  const amministratori = organiAllaData.filter((o: any) => ["amministratore_unico", "amministratore", "presidente_cda", "amministratore_delegato", "liquidatore"].includes(o.ruolo));
  const controllo = organiAllaData.filter((o: any) => ["sindaco", "presidente_collegio_sindacale", "revisore"].includes(o.ruolo));
`;

const newRoles = `  const organiAllaData = (snapshot?.organi_sociali || []).filter((o: any) => organoValidoAllaData(o, dataBilancio));
  const soci = organiAllaData.filter((o: any) => o.ruolo === "socio");
  const amministratori = organiAllaData.filter((o: any) => [
    "amministratore",
    "amministratore_unico",
    "amministratore_delegato",
    "consigliere_delegato",
    "presidente_cda",
    "vice_presidente_cda",
    "consigliere",
    "liquidatore",
    "rappresentante_legale",
  ].includes(o.ruolo));
  const controllo = organiAllaData.filter((o: any) => [
    "sindaco_effettivo",
    "presidente_collegio_sindacale",
    "sindaco_unico",
    "sindaco_supplente",
    "revisore",
    "sindaco",
  ].includes(o.ruolo));
`;

if (source.includes(oldSnapshot)) {
  source = source.replace(oldSnapshot, newSnapshot);
} else if (!source.includes("/api/clienti-organi?cliente_id=")) {
  throw new Error("Blocco caricaSnapshot atteso non trovato");
}

if (source.includes(oldRoles)) {
  source = source.replace(oldRoles, newRoles);
}

const snapshotStart = source.indexOf("async function caricaSnapshot");
const snapshotEnd = source.indexOf("async function caricaBozzaEsistente");
const snapshotBlock = source.slice(snapshotStart, snapshotEnd);

if (snapshotBlock.includes('supabase.from("tbclienti_organi")')) {
  throw new Error("La presa in carico legge ancora direttamente tbclienti_organi");
}
if (!snapshotBlock.includes("/api/clienti-organi?cliente_id=")) {
  throw new Error("Endpoint clienti-organi non applicato");
}
if (!source.includes('"consigliere_delegato"') || !source.includes('"sindaco_effettivo"')) {
  throw new Error("Ruoli societari non allineati");
}

fs.writeFileSync(path, source, "utf8");
console.log("Presa in carico allineata a /api/clienti-organi");
