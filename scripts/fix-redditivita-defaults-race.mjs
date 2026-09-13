import fs from "node:fs";

function patch(file, fn) {
  const src = fs.readFileSync(file, "utf8");
  const out = fn(src);
  if (out !== src) fs.writeFileSync(file, out, "utf8");
  console.log(out === src ? `↷ ${file} già corretto` : `✓ ${file}`);
}

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  source = source.replace(
    'supabaseAdmin.from("tbcdg_attivita_catalogo").insert(daCreare)',
    'supabaseAdmin.from("tbcdg_attivita_catalogo").upsert(daCreare, { onConflict: "studio_id,codice", ignoreDuplicates: true })'
  );

  source = source.replace(
    'supabaseAdmin.from("tbcdg_cliente_servizi").insert(righe.slice(i, i + 300)).select("*")',
    'supabaseAdmin.from("tbcdg_cliente_servizi").upsert(righe.slice(i, i + 300), { onConflict: "studio_id,esercizio,cliente_id,attivita_id", ignoreDuplicates: true }).select("*")'
  );

  source = source.replace(
    'supabaseAdmin.from("tbcdg_cliente_attivita_operatori").insert(assegnazioni.slice(i, i + 300))',
    'supabaseAdmin.from("tbcdg_cliente_attivita_operatori").upsert(assegnazioni.slice(i, i + 300), { onConflict: "cliente_servizio_id,operatore_id", ignoreDuplicates: true })'
  );

  return source;
});

patch("src/pages/controllo-gestione/redditivita-studio.tsx", (source) => {
  // I default sono un backfill di servizio: non devono mai impedire l'apertura del gestionale.
  source = source.replace('{loading || !defaultsReady ? (', '{loading ? (');
  source = source.replace(
    '    if (!studioId || !tabReady || !defaultsReady) return;',
    '    if (!studioId || !tabReady) return;'
  );
  source = source.replace(
    '  }, [studioId, anno, tab, tabReady, defaultsReady]);',
    '  }, [studioId, anno, tab, tabReady]);'
  );
  source = source.replace(
    '        setMessage(e?.message || "Errore inizializzazione servizi standard");',
    '        console.warn("Backfill servizi standard Redditività:", e?.message || e);'
  );

  return source;
});

console.log("✓ Redditività: backfill default race-safe e non bloccante");
