from pathlib import Path

p = Path('src/pages/clienti/index.tsx')
s = p.read_text(encoding='utf-8')
old = s

import_marker = 'import { getSupabaseClient } from "@/lib/supabase/client";\n'
import_line = 'import { syncUtenteFiscaleScadenzari } from "@/services/syncUtenteFiscaleScadenzari";\n'
if import_line not in s:
    if s.count(import_marker) != 1:
        raise SystemExit('import marker mismatch')
    s = s.replace(import_marker, import_marker + import_line, 1)

marker = '''  if (\n    clienteAggiornato.attivo !==\n    formData.attivo\n  ) {\n    throw new Error(\n      `Lo stato Attivo non è stato salvato. ` +\n      `Richiesto: ${formData.attivo}, ` +\n      `salvato nel database: ${clienteAggiornato.attivo}`\n    );\n  }\n\n  await syncClienteToContatto(\n'''
replacement = '''  if (\n    clienteAggiornato.attivo !==\n    formData.attivo\n  ) {\n    throw new Error(\n      `Lo stato Attivo non è stato salvato. ` +\n      `Richiesto: ${formData.attivo}, ` +\n      `salvato nel database: ${clienteAggiornato.attivo}`\n    );\n  }\n\n  const utenteFiscalePrecedente = editingCliente.utente_operatore_id ?? null;\n  const nuovoUtenteFiscale = updateData.utente_operatore_id ?? null;\n\n  if (utenteFiscalePrecedente !== nuovoUtenteFiscale) {\n    await syncUtenteFiscaleScadenzari(\n      editingCliente.id,\n      nuovoUtenteFiscale\n    );\n  }\n\n  await syncClienteToContatto(\n'''

if 'const utenteFiscalePrecedente = editingCliente.utente_operatore_id ?? null;' not in s:
    if s.count(marker) != 1:
        raise SystemExit('save marker mismatch')
    s = s.replace(marker, replacement, 1)

if s == old:
    raise SystemExit('no changes needed')

assert import_line in s
assert 'await syncUtenteFiscaleScadenzari(' in s
assert 'editingCliente.id,' in s
assert 'nuovoUtenteFiscale' in s

p.write_text(s, encoding='utf-8')
