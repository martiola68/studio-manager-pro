import { createClient } from "@supabase/supabase-js";

const SOURCE_EMAIL = "simona.italia@eius-advisory.it";
const TARGET_EMAIL = "s.italia@revisionicommerciali.it";
const CUTOFF = "2026-09-21";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase env mancanti per audit trasferimento Simona Italia");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: users, error: usersError } = await supabase
  .from("tbutenti")
  .select("id, email, studio_id, nome, cognome, attivo")
  .in("email", [SOURCE_EMAIL, TARGET_EMAIL]);

if (usersError) throw usersError;

const source = (users || []).find(
  (u) => String(u.email || "").toLowerCase() === SOURCE_EMAIL
);
const target = (users || []).find(
  (u) => String(u.email || "").toLowerCase() === TARGET_EMAIL
);

if (!source || !target) {
  throw new Error(
    `Utenti non trovati. source=${Boolean(source)} target=${Boolean(target)}`
  );
}

const { data: sourceRows, error: sourceError } = await supabase
  .from("tbpresenze_dipendenti")
  .select(
    "id, studio_id, utente_id, data_presenza, codice_presenza, note, inserito_da, richiesta_ferie_permessi_id, generata_da_richiesta_ferie_permessi, created_at, updated_at"
  )
  .eq("utente_id", source.id)
  .order("data_presenza", { ascending: true });

if (sourceError) throw sourceError;

const { data: targetRows, error: targetError } = await supabase
  .from("tbpresenze_dipendenti")
  .select("id, data_presenza, codice_presenza")
  .eq("utente_id", target.id)
  .order("data_presenza", { ascending: true });

if (targetError) throw targetError;

const sourceThroughCutoff = (sourceRows || []).filter(
  (r) => String(r.data_presenza) <= CUTOFF
);
const sourceFuture = (sourceRows || []).filter(
  (r) => String(r.data_presenza) > CUTOFF
);
const targetByDate = new Map(
  (targetRows || []).map((r) => [String(r.data_presenza), r])
);
const overlaps = sourceThroughCutoff.filter((r) =>
  targetByDate.has(String(r.data_presenza))
);
const conflicts = overlaps.filter((r) => {
  const targetRow = targetByDate.get(String(r.data_presenza));
  return String(targetRow?.codice_presenza || "") !== String(r.codice_presenza || "");
});

console.log("=== AUDIT TRASFERIMENTO PRESENZE SIMONA ITALIA ===");
console.log({
  source: {
    id: source.id,
    email: source.email,
    studio_id: source.studio_id,
    attivo: source.attivo,
  },
  target: {
    id: target.id,
    email: target.email,
    studio_id: target.studio_id,
    attivo: target.attivo,
  },
  cutoff: CUTOFF,
  source_total: (sourceRows || []).length,
  source_through_cutoff: sourceThroughCutoff.length,
  source_first_date: sourceThroughCutoff[0]?.data_presenza || null,
  source_last_date: sourceThroughCutoff.at(-1)?.data_presenza || null,
  source_future_count: sourceFuture.length,
  source_future_dates: sourceFuture.map((r) => r.data_presenza),
  target_total: (targetRows || []).length,
  overlap_count: overlaps.length,
  conflicting_overlap_count: conflicts.length,
  conflicting_dates: conflicts.map((r) => ({
    data: r.data_presenza,
    source: r.codice_presenza,
    target: targetByDate.get(String(r.data_presenza))?.codice_presenza || null,
  })),
});

console.log("=== FINE AUDIT - NESSUNA MODIFICA ESEGUITA ===");
