import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const SOURCE_EMAIL = "simona.italia@eius-advisory.it";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase env mancanti per disattivazione Payroll Simona Italia E-ius");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: users, error: usersError } = await supabase
  .from("tbutenti")
  .select("id, email, studio_id, nome, cognome, attivo, tipo_rapporto")
  .eq("email", SOURCE_EMAIL);

if (usersError) throw usersError;

const user = (users || [])[0] || null;
if (!user) {
  throw new Error("Utenza E-ius di Simona Italia non trovata");
}

const { data: beforeByUser, error: beforeByUserError } = await supabase
  .from("tbdipendenti")
  .select("id, utente_id, email, attivo, data_cessazione")
  .eq("utente_id", user.id);

if (beforeByUserError) throw beforeByUserError;

const { data: beforeByEmail, error: beforeByEmailError } = await supabase
  .from("tbdipendenti")
  .select("id, utente_id, email, attivo, data_cessazione")
  .eq("email", SOURCE_EMAIL);

if (beforeByEmailError) throw beforeByEmailError;

const allBeforeMap = new Map();
for (const row of [...(beforeByUser || []), ...(beforeByEmail || [])]) {
  allBeforeMap.set(String(row.id), row);
}
const allBefore = [...allBeforeMap.values()];

const ids = allBefore.map((row) => row.id);

if (ids.length > 0) {
  const { error: updateError } = await supabase
    .from("tbdipendenti")
    .update({
      attivo: false,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (updateError) throw updateError;
}

const { data: afterRows, error: afterError } = ids.length
  ? await supabase
      .from("tbdipendenti")
      .select("id, utente_id, email, attivo, data_cessazione")
      .in("id", ids)
  : { data: [], error: null };

if (afterError) throw afterError;

const stillActive = (afterRows || []).filter((row) => row.attivo === true);
if (stillActive.length > 0) {
  throw new Error(
    `Disattivazione non completata: ${stillActive.length} record Payroll risultano ancora attivi`
  );
}

const report = {
  status: "completed",
  source_user: {
    id: user.id,
    email: user.email,
    studio_id: user.studio_id,
    user_attivo: user.attivo,
    tipo_rapporto: user.tipo_rapporto,
  },
  payroll_records_found: allBefore.length,
  payroll_records_before: allBefore,
  payroll_records_after: afterRows || [],
  payroll_active_remaining: stillActive.length,
  user_account_modified: false,
  generated_at: new Date().toISOString(),
};

mkdirSync("public", { recursive: true });
writeFileSync(
  "public/oneoff-disable-simona-eius-payroll.json",
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log("✓ Simona Italia E-ius disattivata dal Payroll; utenza generale lasciata invariata");
console.log(report);
