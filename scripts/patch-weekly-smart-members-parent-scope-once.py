from pathlib import Path

p = Path('src/pages/presenze/assenze-settimanali.tsx')
s = p.read_text(encoding='utf-8')
old = s

old_query = '''        supabase
          .from("tbpresenze_smart_gruppi_utenti")
          .select("id, gruppo_id, utente_id, ordine, giorni_presenza")
          .eq("studio_id", currentStudioId)
          .eq("attivo", true)
          .order("ordine", { ascending: true }),'''
new_query = '''        supabase
          .from("tbpresenze_smart_gruppi_utenti")
          .select("id, gruppo_id, utente_id, ordine, giorni_presenza")
          .eq("attivo", true)
          .order("ordine", { ascending: true }),'''

if old_query not in s:
    raise SystemExit('smart members query marker not found')
s = s.replace(old_query, new_query, 1)

old_loop = '''      const membriPerGruppo = new Map<string, any[]>();
      for (const membro of gruppiUtentiData || []) {
        const lista = membriPerGruppo.get(membro.gruppo_id) || [];
        lista.push(membro);
        membriPerGruppo.set(membro.gruppo_id, lista);
      }
'''
new_loop = '''      const membriPerGruppo = new Map<string, any[]>();
      for (const membro of gruppiUtentiData || []) {
        // Lo studio viene validato dal gruppo padre: così includiamo anche
        // i membri legacy che hanno studio_id nullo nella tabella ponte.
        if (!gruppiById.has(membro.gruppo_id)) continue;
        const lista = membriPerGruppo.get(membro.gruppo_id) || [];
        lista.push(membro);
        membriPerGruppo.set(membro.gruppo_id, lista);
      }
'''
if old_loop not in s:
    raise SystemExit('members grouping marker not found')
s = s.replace(old_loop, new_loop, 1)

if s == old:
    raise SystemExit('no changes applied')

assert '.eq("studio_id", currentStudioId)' not in s[s.index('.from("tbpresenze_smart_gruppi_utenti")'):s.index('.from("tbpresenze_smart_gruppi_utenti")')+300]
assert 'if (!gruppiById.has(membro.gruppo_id)) continue;' in s

p.write_text(s, encoding='utf-8')
