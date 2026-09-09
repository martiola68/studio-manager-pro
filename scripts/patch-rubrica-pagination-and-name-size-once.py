from pathlib import Path

# ---------------------------------------------------------
# 1) Pagina tutti i contatti/relazioni oltre il limite Supabase di 1000 righe
# ---------------------------------------------------------
p = Path('src/services/contattoService.ts')
s = p.read_text(encoding='utf-8')
old = s

insert_marker = '''export const contattoService = {\n'''
helpers = '''const RUBRICA_PAGE_SIZE = 1000;\n\nconst fetchAllContatti = async (studioId?: string | null): Promise<Contatto[]> => {\n  const rows: Contatto[] = [];\n  let from = 0;\n\n  while (true) {\n    let query = supabase\n      .from("tbcontatti")\n      .select("*")\n      .order("cognome", { ascending: true })\n      .range(from, from + RUBRICA_PAGE_SIZE - 1);\n\n    if (studioId) query = query.eq("studio_id", studioId);\n\n    const { data, error } = await query;\n    if (error) throw error;\n\n    const batch = (data || []) as Contatto[];\n    rows.push(...batch);\n\n    if (batch.length < RUBRICA_PAGE_SIZE) break;\n    from += RUBRICA_PAGE_SIZE;\n  }\n\n  return rows;\n};\n\nconst fetchAllRelazioniClienti = async (studioId?: string | null): Promise<any[]> => {\n  const rows: any[] = [];\n  let from = 0;\n\n  while (true) {\n    let query = db\n      .from("tbcontatti_clienti")\n      .select("*")\n      .range(from, from + RUBRICA_PAGE_SIZE - 1);\n\n    if (studioId) query = query.eq("studio_id", studioId);\n\n    const { data, error } = await query;\n    if (error) throw error;\n\n    const batch = data || [];\n    rows.push(...batch);\n\n    if (batch.length < RUBRICA_PAGE_SIZE) break;\n    from += RUBRICA_PAGE_SIZE;\n  }\n\n  return rows;\n};\n\n'''

if 'const RUBRICA_PAGE_SIZE = 1000;' not in s:
    if s.count(insert_marker) != 1:
        raise SystemExit('contattoService insert marker mismatch')
    s = s.replace(insert_marker, helpers + insert_marker, 1)

old_get = '''  async getContatti(studioId?: string | null): Promise<Contatto[]> {\n    let query = supabase\n      .from("tbcontatti")\n      .select("*")\n      .order("cognome", { ascending: true });\n\n    if (studioId) {\n      query = query.eq("studio_id", studioId);\n    }\n\n    const { data, error } = await query;\n\n    if (error) throw error;\n    return data || [];\n  },\n'''
new_get = '''  async getContatti(studioId?: string | null): Promise<Contatto[]> {\n    return fetchAllContatti(studioId);\n  },\n'''
if old_get in s:
    s = s.replace(old_get, new_get, 1)

old_block = '''    let contattiQuery = supabase\n      .from("tbcontatti")\n      .select("*")\n      .order("cognome", { ascending: true });\n\n    if (studioId) {\n      contattiQuery = contattiQuery.eq("studio_id", studioId);\n    }\n\n    const { data: contatti, error: contattiError } = await contattiQuery;\n\n    if (contattiError) throw contattiError;\n\n    let relazioniQuery = db.from("tbcontatti_clienti").select("*");\n\n    if (studioId) {\n      relazioniQuery = relazioniQuery.eq("studio_id", studioId);\n    }\n\n    const { data: relazioni, error: relazioniError } = await relazioniQuery;\n\n    if (relazioniError) throw relazioniError;\n'''
new_block = '''    const contatti = await fetchAllContatti(studioId);\n    const relazioni = await fetchAllRelazioniClienti(studioId);\n'''
if old_block in s:
    s = s.replace(old_block, new_block, 1)

if s == old:
    raise SystemExit('no contattoService changes applied')

assert 'return fetchAllContatti(studioId);' in s
assert 'const relazioni = await fetchAllRelazioniClienti(studioId);' in s
p.write_text(s, encoding='utf-8')

# ---------------------------------------------------------
# 2) Nominativo Rubrica: solo +1px rispetto al text-xl precedente
# ---------------------------------------------------------
p = Path('src/pages/contatti/index.tsx')
s = p.read_text(encoding='utf-8')
old = s

# Solo i nominativi dei contatti/referenti, non gli header blu.
s = s.replace('className="text-xl font-bold text-gray-900"', 'className="text-[21px] font-bold text-gray-900"')

if s == old:
    raise SystemExit('no Rubrica name-size changes applied')

assert 'text-[21px] font-bold text-gray-900' in s
p.write_text(s, encoding='utf-8')
