from pathlib import Path
import re

# 1) Bilanci sticky Nominativo header: override global white background.
p = Path('src/pages/scadenze/bilanci.tsx')
s = p.read_text(encoding='utf-8')
old = 'bg-slate-600 sticky-col-header min-w-[200px]'
new = 'bg-slate-600 sticky-col-header min-w-[300px] !bg-slate-600'
if old in s:
    s = s.replace(old, new, 1)
else:
    old2 = 'bg-slate-600 sticky-col-header min-w-[300px]'
    if old2 in s and '!bg-slate-600' not in s[s.find(old2):s.find(old2)+120]:
        s = s.replace(old2, old2 + ' !bg-slate-600', 1)
    elif '!bg-slate-600' not in s:
        raise SystemExit('Bilanci sticky header marker not found')
p.write_text(s, encoding='utf-8')

# 2) Keep generated type snapshots aligned with DB migration.
for path in [Path('src/lib/supabase/database.types.ts'), Path('src/integrations/supabase/database.types.ts')]:
    t = path.read_text(encoding='utf-8')

    # Replace relation property types wherever tbscadbilanci Row/Insert/Update definitions occur.
    for field in ['relazione_gest', 'relazione_sindaci', 'relazione_revisore']:
        t = re.sub(
            rf'(^\s*{field}\??:) boolean \| null',
            rf'\1 string | null',
            t,
            flags=re.M,
        )

    # Add tipo_bilancio near note when missing in tbscadbilanci definitions. We only do bounded replacements
    # around occurrences containing bilancio fields to avoid unrelated tables.
    blocks = []
    pos = 0
    while True:
        idx = t.find('tbscadbilanci:', pos)
        if idx < 0:
            break
        end = t.find('\n      }', idx)
        if end < 0:
            break
        blocks.append((idx, end))
        pos = end + 1

    # Usually one table block contains Row/Insert/Update nested sections; simple safe insertion per section.
    start = t.find('tbscadbilanci:')
    if start >= 0:
        end = t.find('\n      }', start)
        # Work in a generous slice because generated nested object is long.
        end = min(len(t), start + 14000)
        chunk = t[start:end]
        if 'tipo_bilancio:' not in chunk:
            chunk = chunk.replace('          note: string | null\n', '          note: string | null\n          tipo_bilancio: string\n', 1)
            chunk = chunk.replace('          note?: string | null\n', '          note?: string | null\n          tipo_bilancio?: string\n', 2)
            t = t[:start] + chunk + t[end:]

    path.write_text(t, encoding='utf-8')

print('Bilanci header and type snapshots aligned')
