from pathlib import Path

page = Path('src/pages/promemoria/index.tsx')
service = Path('src/services/promemoriaService.ts')
migration = Path('supabase/migrations/20260903090000_promemoria_tipo_altro_not_null.sql')

s = page.read_text(encoding='utf-8')
old = s

# Helper: Altro is the only allowed fallback when a type is missing.
marker = '  const [formData, setFormData] = useState({'
helper = '''  const getAltroTipoPromemoriaId = useCallback(() =>\n    tipiPromemoria.find((t) => t.nome.trim().toLowerCase() === "altro")?.id || "",\n  [tipiPromemoria]);\n\n'''
if helper.strip() not in s:
    if s.count(marker) != 1:
        raise SystemExit('formData marker mismatch')
    s = s.replace(marker, helper + marker, 1)

# When catalog loads, any empty form gets Altro automatically.
load_marker = '      if (tipiData.data) setTipiPromemoria(tipiData.data);'
load_repl = '''      if (tipiData.data) {\n        setTipiPromemoria(tipiData.data);\n        const altroId = tipiData.data.find((t) => String(t.nome || "").trim().toLowerCase() === "altro")?.id || "";\n        if (altroId) setFormData((prev) => ({ ...prev, tipo_promemoria_id: prev.tipo_promemoria_id || altroId }));\n      }'''
if load_marker in s:
    s = s.replace(load_marker, load_repl, 1)
elif load_repl not in s:
    raise SystemExit('tipiData marker mismatch')

# Reset defaults to Altro, never blank.
s = s.replace('      tipo_promemoria_id: "",\n      invia_teams: false\n    });', '      tipo_promemoria_id: getAltroTipoPromemoriaId(),\n      invia_teams: false\n    });', 1)

# Legacy rows with null are edited as Altro.
s = s.replace('tipo_promemoria_id: p.tipo_promemoria_id || "", invia_teams: false', 'tipo_promemoria_id: p.tipo_promemoria_id || getAltroTipoPromemoriaId(), invia_teams: false', 1)
s = s.replace('  }, []);\n', '  }, [getAltroTipoPromemoriaId]);\n', 1)

# Every create path must resolve Altro instead of null.
s = s.replace('tipo_promemoria_id: formData.tipo_promemoria_id || null', 'tipo_promemoria_id: formData.tipo_promemoria_id || getAltroTipoPromemoriaId()')

# Strong UI guard before create: if catalog is unexpectedly missing Altro, block rather than save null.
create_marker = '  const handleCreate = async (e: React.FormEvent) => {'
if create_marker in s and 'Tipo promemoria non disponibile' not in s:
    s = s.replace(create_marker, create_marker + '''\n    const tipoPromemoriaId = formData.tipo_promemoria_id || getAltroTipoPromemoriaId();\n    if (!tipoPromemoriaId) {\n      e.preventDefault();\n      toast({ title: "Errore", description: "Tipo promemoria non disponibile: verificare la voce Altro.", variant: "destructive" });\n      return;\n    }\n    if (!formData.tipo_promemoria_id) setFormData((prev) => ({ ...prev, tipo_promemoria_id: tipoPromemoriaId }));''', 1)

if s == old:
    raise SystemExit('page no changes')
page.write_text(s, encoding='utf-8')

ss = service.read_text(encoding='utf-8')
old_ss = ss

# Service-level safety: resolve Altro server-side through the same catalog if a caller omits the type.
create_sig = 'async createPromemoria(nuovoPromemoria: {'
body_marker = '}) {\n    const { data, error } = await supabase\n      .from("tbpromemoria")'
if create_sig not in ss or body_marker not in ss:
    raise SystemExit('service create marker mismatch')
if 'tipoPromemoriaIdFinale' not in ss:
    body_repl = '''}) {\n    let tipoPromemoriaIdFinale = nuovoPromemoria.tipo_promemoria_id || null;\n    if (!tipoPromemoriaIdFinale) {\n      const { data: tipoAltro, error: tipoAltroError } = await supabase\n        .from("tbtipopromemoria")\n        .select("id")\n        .eq("origine", "S")\n        .ilike("nome", "Altro")\n        .limit(1)\n        .maybeSingle();\n      if (tipoAltroError) throw tipoAltroError;\n      if (!tipoAltro?.id) throw new Error('Tipo promemoria "Altro" non configurato.');\n      tipoPromemoriaIdFinale = tipoAltro.id;\n    }\n\n    const { data, error } = await supabase\n      .from("tbpromemoria")'''
    ss = ss.replace(body_marker, body_repl, 1)
ss = ss.replace('tipo_promemoria_id: nuovoPromemoria.tipo_promemoria_id || null,', 'tipo_promemoria_id: tipoPromemoriaIdFinale,', 1)

if ss == old_ss:
    raise SystemExit('service no changes')
service.write_text(ss, encoding='utf-8')

migration.write_text('''begin;\n\n-- Garantisce la voce di fallback di sistema.\ninsert into public.tbtipopromemoria (nome, descrizione, colore, origine, studio_id)\nselect 'Altro', null, '#3B82F6', 'S', null\nwhere not exists (\n  select 1 from public.tbtipopromemoria\n  where lower(trim(nome)) = 'altro' and origine = 'S'\n);\n\n-- Bonifica tutti i promemoria storici privi di tipo.\nupdate public.tbpromemoria p\nset tipo_promemoria_id = (\n  select t.id from public.tbtipopromemoria t\n  where lower(trim(t.nome)) = 'altro' and t.origine = 'S'\n  order by t.created_at nulls last, t.id\n  limit 1\n)\nwhere p.tipo_promemoria_id is null;\n\n-- Da questo punto il tipo è obbligatorio anche a livello DB.\nalter table public.tbpromemoria\n  alter column tipo_promemoria_id set not null;\n\ncommit;\n''', encoding='utf-8')
