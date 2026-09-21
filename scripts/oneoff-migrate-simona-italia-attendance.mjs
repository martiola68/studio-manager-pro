import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const SOURCE_EMAIL = "simona.italia@eius-advisory.it";
const TARGET_EMAIL = "s.italia@revisionicommerciali.it";
const CUTOFF = "2026-09-21";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase env mancanti per trasferimento Simona Italia");
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

if (String(source.studio_id) !== String(target.studio_id)) {
  throw new Error("Le due utenze appartengono a studi diversi: migrazione annullata");
}

const { data: sourceRows, error: sourceError } = await supabase
  .from("tbpresenze_dipendenti")
  .select(
    "id, studio_id, utente_id, data_presenza, codice_presenza, note, inserito_da, richiesta_ferie_permessi_id, generata_da_richiesta_ferie_permessi, created_at, updated_at"
  )
  .eq("utente_id", source.id)
  .order("data_presenza", { ascending: true });

if (sourceError) throw sourceError;

const sourceAll = sourceRows || [];

if (sourceAll.length === 0) {
  const { data: targetAfter, error: targetAfterError } = await supabase
    .from("tbpresenze_dipendenti")
    .select("id, data_presenza, codice_presenza")
    .eq("utente_id", target.id)
    .order("data_presenza", { ascending: true });

  if (targetAfterError) throw targetAfterError;

  const report = {
    status: "already_migrated",
    source_email: SOURCE_EMAIL,
    target_email: TARGET_EMAIL,
    cutoff: CUTOFF,
    source_remaining: 0,
    target_total: (targetAfter || []).length,
    generated_at: new Date().toISOString(),
  };

  mkdirSync("public", { recursive: true });
  writeFileSync(
    "public/oneoff-migration-simona.json",
    JSON.stringify(report, null, 2),
    "utf8"
  );
  console.log("✓ Trasferimento Simona Italia già eseguito in precedenza");
  process.exit(0);
}

const eligible = sourceAll.filter(
  (row) => String(row.data_presenza) <= CUTOFF
);
const futureRows = sourceAll.filter(
  (row) => String(row.data_presenza) > CUTOFF
);

const { data: targetBefore, error: targetBeforeError } = await supabase
  .from("tbpresenze_dipendenti")
  .select("id, data_presenza, codice_presenza")
  .eq("utente_id", target.id)
  .order("data_presenza", { ascending: true });

if (targetBeforeError) throw targetBeforeError;

const targetByDate = new Map(
  (targetBefore || []).map((row) => [String(row.data_presenza), row])
);

const conflicts = eligible.filter((row) => {
  const existing = targetByDate.get(String(row.data_presenza));
  return (
    existing &&
    String(existing.codice_presenza || "") !== String(row.codice_presenza || "")
  );
});

if (conflicts.length > 0) {
  throw new Error(
    `Migrazione annullata: ${conflicts.length} date hanno codici diversi tra sorgente e destinazione`
  );
}

const rowsToInsert = eligible
  .filter((row) => !targetByDate.has(String(row.data_presenza)))
  .map((row) => ({
    studio_id: target.studio_id,
    utente_id: target.id,
    data_presenza: row.data_presenza,
    codice_presenza: row.codice_presenza,
    note: row.note || null,
    inserito_da: target.id,
    richiesta_ferie_permessi_id: null,
    generata_da_richiesta_ferie_permessi: false,
    updated_at: new Date().toISOString(),
  }));

const sourceRequestLinkedCount = eligible.filter(
  (row) =>
    row.richiesta_ferie_permessi_id ||
    row.generata_da_richiesta_ferie_permessi
).length;

if (rowsToInsert.length > 0) {
  const { error: insertError } = await supabase
    .from("tbpresenze_dipendenti")
    .insert(rowsToInsert);

  if (insertError) throw insertError;
}

const { data: targetVerify, error: verifyError } = await supabase
  .from("tbpresenze_dipendenti")
  .select("data_presenza, codice_presenza")
  .eq("utente_id", target.id)
  .lte("data_presenza", CUTOFF);

if (verifyError) throw verifyError;

const verifiedTargetByDate = new Map(
  (targetVerify || []).map((row) => [String(row.data_presenza), row])
);

const missingAfterCopy = eligible.filter((row) => {
  const copied = verifiedTargetByDate.get(String(row.data_presenza));
  return (
    !copied ||
    String(copied.codice_presenza || "") !== String(row.codice_presenza || "")
  );
});

if (missingAfterCopy.length > 0) {
  throw new Error(
    `Verifica fallita: ${missingAfterCopy.length} presenze non risultano correttamente trasferite`
  );
}

const { error: deleteError } = await supabase
  .from("tbpresenze_dipendenti")
  .delete()
  .eq("utente_id", source.id);

if (deleteError) throw deleteError;

const { count: sourceRemaining, error: countError } = await supabase
  .from("tbpresenze_dipendenti")
  .select("id", { count: "exact", head: true })
  .eq("utente_id", source.id);

if (countError) throw countError;

if ((sourceRemaining || 0) !== 0) {
  throw new Error(
    `Azzeramento sorgente non riuscito: restano ${sourceRemaining} presenze E-ius`
  );
}

const { count: targetTotal, error: targetCountError } = await supabase
  .from("tbpresenze_dipendenti")
  .select("id", { count: "exact", head: true })
  .eq("utente_id", target.id);

if (targetCountError) throw targetCountError;

const report = {
  status: "completed",
  source: {
    id: source.id,
    email: source.email,
  },
  target: {
    id: target.id,
    email: target.email,
  },
  cutoff: CUTOFF,
  source_initial_total: sourceAll.length,
  source_eligible_through_cutoff: eligible.length,
  source_first_date: eligible[0]?.data_presenza || null,
  source_last_date: eligible.at(-1)?.data_presenza || null,
  source_future_not_copied_but_removed: futureRows.map((r) => r.data_presenza),
  target_initial_total: (targetBefore || []).length,
  target_existing_matching_dates: eligible.length - rowsToInsert.length,
  rows_inserted: rowsToInsert.length,
  request_linked_rows_copied_without_old_request_link: sourceRequestLinkedCount,
  verified_dates_through_cutoff: eligible.length,
  source_remaining_after_cleanup: sourceRemaining || 0,
  target_total_after_migration: targetTotal || 0,
  generated_at: new Date().toISOString(),
};

mkdirSync("public", { recursive: true });
writeFileSync(
  "public/oneoff-migration-simona.json",
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log("✓ Trasferimento presenze Simona Italia completato e verificato");
console.log(report);
