from pathlib import Path

p = Path('src/pages/presenze/smart-gruppi.tsx')
s = p.read_text(encoding='utf-8')
old = s

# 1) stato modifica
marker = '  const [loading, setLoading] = useState(false);\n'
insert = marker + '  const [gruppoInModifica, setGruppoInModifica] = useState<string | null>(null);\n'
if 'const [gruppoInModifica' not in s:
    if marker not in s:
        raise SystemExit('loading state marker mismatch')
    s = s.replace(marker, insert, 1)

# 2) helpers modifica/reset prima di creaGruppo
marker = '  async function creaGruppo() {\n'
helpers = '''  function resetFormGruppo() {
    setGruppoInModifica(null);
    setForm({
      settore: "Fiscale",
      tipo_rapporto: "Dipendente",
      nome_gruppo: "Turnazione smart working",
      giorno_fisso: 2,
      presenze_settimanali: 2,
      scelta_libera: false,
    });
    setUtentiSelezionati([]);
    setGiorniPerUtente({});
    setUtenteDaAggiungere("");
  }

  function modificaGruppo(g: Gruppo) {
    setGruppoSelezionato(g.id);
    setGruppoInModifica(g.id);
    setForm({
      settore: g.settore,
      tipo_rapporto: g.tipo_rapporto || "",
      nome_gruppo: g.nome_gruppo,
      giorno_fisso: g.giorno_fisso || 2,
      presenze_settimanali: g.presenze_settimanali || 2,
      scelta_libera: !!g.scelta_libera,
    });

    const ids = (g.utenti || []).map((u) => u.utente_id).filter(Boolean);
    const giorniMap: Record<string, number[]> = {};
    (g.utenti || []).forEach((u) => {
      giorniMap[u.utente_id] = Array.isArray(u.giorni_presenza)
        ? u.giorni_presenza
        : [];
    });
    setUtentiSelezionati(ids);
    setGiorniPerUtente(giorniMap);
    setUtenteDaAggiungere("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

'''
if 'function modificaGruppo(g: Gruppo)' not in s:
    if marker not in s:
        raise SystemExit('creaGruppo marker mismatch')
    s = s.replace(marker, helpers + marker, 1)

# 3) creaGruppo diventa create/update
old_fetch = '''      const res = await fetch("/api/presenze/smart/gruppi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          studio_id: studioId,
          utenti: utentiSelezionati.map((utente_id) => ({
            utente_id,
            giorni_presenza: form.scelta_libera ? (giorniPerUtente[utente_id] || []) : null,
          })),
        }),
      });'''
new_fetch = '''      const res = await fetch("/api/presenze/smart/gruppi", {
        method: gruppoInModifica ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          gruppo_id: gruppoInModifica || undefined,
          studio_id: studioId,
          utenti: utentiSelezionati.map((utente_id) => ({
            utente_id,
            giorni_presenza: form.scelta_libera ? (giorniPerUtente[utente_id] || []) : null,
          })),
        }),
      });'''
if old_fetch not in s:
    raise SystemExit('create fetch block mismatch')
s = s.replace(old_fetch, new_fetch, 1)

old_success = '''      setUtentiSelezionati([]);
      setGiorniPerUtente({});
      setGruppoSelezionato(data.id);
      await loadGruppi();

      alert("Gruppo creato correttamente");'''
new_success = '''      setGruppoSelezionato(data.id);
      const wasEditing = !!gruppoInModifica;
      resetFormGruppo();
      await loadGruppi();

      alert(wasEditing ? "Gruppo modificato correttamente" : "Gruppo creato correttamente");'''
if old_success not in s:
    raise SystemExit('create success block mismatch')
s = s.replace(old_success, new_success, 1)

# 4) eliminaGruppo accetta id della riga
s = s.replace('  async function eliminaGruppo() {\n    if (!gruppoSelezionato) {', '  async function eliminaGruppo(gruppoId?: string) {\n    const idDaEliminare = gruppoId || gruppoSelezionato;\n    if (!idDaEliminare) {', 1)
s = s.replace('''      body: JSON.stringify({
        gruppo_id: gruppoSelezionato,
      }),''','''      body: JSON.stringify({
        gruppo_id: idDaEliminare,
      }),''', 1)
s = s.replace('''    setGruppoSelezionato("");
    await loadGruppi();''','''    if (gruppoSelezionato === idDaEliminare) {
      setGruppoSelezionato("");
    }
    if (gruppoInModifica === idDaEliminare) {
      resetFormGruppo();
    }
    await loadGruppi();''', 1)

# 5) titolo card nuovo/modifica + pulsante annulla
s = s.replace('<h2 className="font-semibold">Nuovo gruppo</h2>', '<div className="flex items-center justify-between gap-3">\n            <h2 className="font-semibold">{gruppoInModifica ? "Modifica gruppo" : "Nuovo gruppo"}</h2>\n            {gruppoInModifica && (\n              <button type="button" onClick={resetFormGruppo} className="border px-3 py-1 rounded text-slate-600">Annulla modifica</button>\n            )}\n          </div>', 1)
s = s.replace('{loading ? "Salvataggio..." : "Crea gruppo"}', '{loading ? "Salvataggio..." : gruppoInModifica ? "Salva modifiche" : "Crea gruppo"}', 1)

# 6) rimuove pulsante elimina gruppo dalla Gestione gruppo esistente
old_delete_button = '''<button
  type="button"
  onClick={eliminaGruppo}
  disabled={loading || !gruppoSelezionato}
  className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
>
  Elimina gruppo
</button>
'''
if old_delete_button in s:
    s = s.replace(old_delete_button, '', 1)

# 7) sostituisce riepilogo sintetico con elenco utenti + giorni
old_summary = '''            {gruppoCorrente && (
              <div className="text-sm text-gray-600">
                Settore: <strong>{gruppoCorrente.settore}</strong> · Giorno fisso:{" "}
                <strong>{gruppoCorrente.scelta_libera ? "A scelta libera" : giornoLabel(gruppoCorrente.giorno_fisso)}</strong> ·
                Presenze settimanali:{" "}
                <strong>{gruppoCorrente.presenze_settimanali}</strong>
              </div>
            )}'''
new_summary = '''            {gruppoCorrente && (
              <div className="space-y-3">
                <div className="text-gray-600">
                  Settore: <strong>{gruppoCorrente.settore}</strong> · Modalità:{" "}
                  <strong>{gruppoCorrente.scelta_libera ? "A scelta libera" : `Giorno fisso: ${giornoLabel(gruppoCorrente.giorno_fisso)}`}</strong>
                </div>
                <div className="border rounded-md bg-white overflow-hidden">
                  {(gruppoCorrente.utenti || []).map((rel) => {
                    const giorniUtente = rel.giorni_presenza || [];
                    const dettaglio = gruppoCorrente.scelta_libera
                      ? giorniUtente.length
                        ? giorniUtente.map(giornoLabel).join(", ")
                        : "Smart working tutta la settimana"
                      : `${gruppoCorrente.presenze_settimanali} presenze/settimana · ${giornoLabel(gruppoCorrente.giorno_fisso)} fisso`;
                    return (
                      <div key={rel.id} className="flex items-center justify-between gap-4 border-b last:border-b-0 px-3 py-2">
                        <strong>{nomeUtente(rel.utente)}</strong>
                        <span className="text-slate-600">{dettaglio}</span>
                      </div>
                    );
                  })}
                  {(gruppoCorrente.utenti || []).length === 0 && (
                    <div className="px-3 py-2 text-slate-500">Nessun utente associato.</div>
                  )}
                </div>
              </div>
            )}'''
if old_summary not in s:
    raise SystemExit('management summary block mismatch')
s = s.replace(old_summary, new_summary, 1)

# 8) tabella: colonna Azioni, selezione/evidenza riga e icone modifica/elimina
s = s.replace('<th className="border p-2 text-left">Utenti</th>', '<th className="border p-2 text-left">Utenti</th>\n                  <th className="border p-2 text-center w-[110px]">Azioni</th>', 1)
s = s.replace('<tr key={g.id}>', '<tr\n                    key={g.id}\n                    onClick={() => setGruppoSelezionato(g.id)}\n                    className={`cursor-pointer ${gruppoSelezionato === g.id ? "bg-sky-100 ring-1 ring-inset ring-sky-400" : "hover:bg-slate-50"}`}\n                  >', 1)
old_users_td = '''                    <td className="border p-2">
                      {(g.utenti || [])
                        .map((u) => nomeUtente(u.utente))
                        .filter(Boolean)
                        .join(", ")}
                    </td>
                  </tr>'''
new_users_td = '''                    <td className="border p-2">
                      {(g.utenti || [])
                        .map((u) => nomeUtente(u.utente))
                        .filter(Boolean)
                        .join(", ")}
                    </td>
                    <td className="border p-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          title="Modifica gruppo"
                          aria-label={`Modifica ${g.nome_gruppo}`}
                          onClick={(e) => { e.stopPropagation(); modificaGruppo(g); }}
                          className="border border-blue-500 text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          title="Elimina gruppo"
                          aria-label={`Elimina ${g.nome_gruppo}`}
                          onClick={(e) => { e.stopPropagation(); setGruppoSelezionato(g.id); eliminaGruppo(g.id); }}
                          className="border border-red-500 text-red-600 px-2 py-1 rounded hover:bg-red-50"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>'''
if old_users_td not in s:
    raise SystemExit('table users cell block mismatch')
s = s.replace(old_users_td, new_users_td, 1)
s = s.replace('colSpan={6}', 'colSpan={7}', 1)

if s == old:
    raise SystemExit('no changes')

checks = [
    'Modifica gruppo',
    'Salva modifiche',
    'Smart working tutta la settimana',
    'title="Elimina gruppo"',
    'title="Modifica gruppo"',
    'colSpan={7}',
]
for c in checks:
    if c not in s:
        raise SystemExit(f'missing expected runtime token: {c}')

p.write_text(s, encoding='utf-8')
