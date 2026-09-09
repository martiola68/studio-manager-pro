from pathlib import Path

p = Path('src/pages/presenze/assenze-settimanali.tsx')
s = p.read_text(encoding='utf-8')
old = s

old_head = '''      const [
        { data: utentiData, error: utentiError },
        { data: presenzeData, error: presenzeError },
        { data: smartData, error: smartError },
        { data: gruppiData, error: gruppiError },
        { data: gruppiUtentiData, error: gruppiUtentiError },
      ] = await Promise.all(['''
new_head = '''      const [
        { data: utentiData, error: utentiError },
        { data: presenzeData, error: presenzeError },
        { data: smartData, error: smartError },
        gruppiResponse,
      ] = await Promise.all(['''
if old_head not in s:
    raise SystemExit('promise head not found')
s = s.replace(old_head, new_head, 1)

old_queries = '''        supabase
          .from("tbpresenze_smart_gruppi")
          .select("id, giorno_fisso, scelta_libera")
          .eq("studio_id", currentStudioId)
          .eq("attivo", true),

        supabase
          .from("tbpresenze_smart_gruppi_utenti")
          .select("id, gruppo_id, utente_id, ordine, giorni_presenza")
          .eq("attivo", true)
          .order("ordine", { ascending: true }),
      ]);'''
new_queries = '''        fetch("/api/presenze/smart/gruppi"),
      ]);'''
if old_queries not in s:
    raise SystemExit('group direct queries not found')
s = s.replace(old_queries, new_queries, 1)

old_errors = '''      if (utentiError) throw utentiError;
      if (presenzeError) throw presenzeError;
      if (smartError) throw smartError;
      if (gruppiError) throw gruppiError;
      if (gruppiUtentiError) throw gruppiUtentiError;

      const actualRows = (presenzeData || []) as Presenza[];'''
new_errors = '''      if (utentiError) throw utentiError;
      if (presenzeError) throw presenzeError;
      if (smartError) throw smartError;
      if (!gruppiResponse.ok) {
        const body = await gruppiResponse.json().catch(() => ({}));
        throw new Error(body?.error || "Errore caricamento gruppi Smart Working");
      }

      const gruppiRaw = await gruppiResponse.json();
      const gruppiData = Array.isArray(gruppiRaw)
        ? gruppiRaw.filter((gruppo: any) => gruppo.studio_id === currentStudioId)
        : [];
      const gruppiUtentiData = gruppiData.flatMap((gruppo: any) =>
        (gruppo.utenti || []).map((membro: any) => ({
          ...membro,
          gruppo_id: gruppo.id,
        }))
      );

      const actualRows = (presenzeData || []) as Presenza[];'''
if old_errors not in s:
    raise SystemExit('error block not found')
s = s.replace(old_errors, new_errors, 1)

# In questa versione l'API admin è la sorgente autorevole dei membri del gruppo.
# Non applicare filtri client-side basati sui campi legacy della tabella ponte.
old_grouping = '''      const membriPerGruppo = new Map<string, any[]>();
      for (const membro of gruppiUtentiData || []) {
        // Lo studio viene validato dal gruppo padre: così includiamo anche
        // i membri legacy che hanno studio_id nullo nella tabella ponte.
        if (!gruppiById.has(membro.gruppo_id)) continue;
        const lista = membriPerGruppo.get(membro.gruppo_id) || [];
        lista.push(membro);
        membriPerGruppo.set(membro.gruppo_id, lista);
      }
'''
new_grouping = '''      const membriPerGruppo = new Map<string, any[]>();
      for (const membro of gruppiUtentiData || []) {
        if (!gruppiById.has(membro.gruppo_id)) continue;
        const lista = membriPerGruppo.get(membro.gruppo_id) || [];
        lista.push(membro);
        membriPerGruppo.set(membro.gruppo_id, lista);
      }
'''
if old_grouping in s:
    s = s.replace(old_grouping, new_grouping, 1)

if s == old:
    raise SystemExit('no changes applied')

for token in [
    'fetch("/api/presenze/smart/gruppi")',
    'gruppo.studio_id === currentStudioId',
    'const gruppiUtentiData = gruppiData.flatMap',
]:
    if token not in s:
        raise SystemExit(f'missing token: {token}')

p.write_text(s, encoding='utf-8')
