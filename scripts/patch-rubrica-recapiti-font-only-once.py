from pathlib import Path

p = Path('src/pages/contatti/index.tsx')
s = p.read_text(encoding='utf-8')
old = s

# Ripristina le dimensioni originali di titoli, nominativi, badge e ricerca.
s = s.replace('className="flex items-center justify-between text-2xl"', 'className="flex items-center justify-between text-xl"')
s = s.replace('className="rounded-full bg-blue-700 px-3 py-1 text-base font-semibold text-white"', 'className="rounded-full bg-blue-700 px-3 py-1 text-sm font-semibold text-white"')
s = s.replace('className="text-2xl font-bold text-gray-900"', 'className="text-xl font-bold text-gray-900"')
s = s.replace('className="rounded bg-red-600 px-2 py-1 text-sm font-bold text-white"', 'className="rounded bg-red-600 px-2 py-1 text-xs font-bold text-white"')
s = s.replace('className="h-12 pl-10 text-lg"', 'className="h-12 pl-10"')

# Nella vista società il ruolo non è un recapito: torna alla misura normale.
# Email e cellulare restano invece ingranditi singolarmente.
old_grid = 'className="mt-2 grid grid-cols-1 gap-3 text-lg text-gray-700 md:grid-cols-3"'
new_grid = 'className="mt-2 grid grid-cols-1 gap-3 text-base text-gray-700 md:grid-cols-3"'
# La prima occorrenza appartiene ai referenti della vista società.
if old_grid in s:
    s = s.replace(old_grid, new_grid, 1)

s = s.replace(
    'className="flex items-center gap-2">\n                    <Mail className="h-5 w-5 text-blue-600" />\n                    {contatto.email}',
    'className="flex items-center gap-2 text-lg">\n                    <Mail className="h-5 w-5 text-blue-600" />\n                    {contatto.email}',
    1,
)
s = s.replace(
    'className="flex items-center gap-2">\n                    <Smartphone className="h-5 w-5 text-blue-600" />\n                    {contatto.cell}',
    'className="flex items-center gap-2 text-lg">\n                    <Smartphone className="h-5 w-5 text-blue-600" />\n                    {contatto.cell}',
    1,
)

if s == old:
    raise SystemExit('no Rubrica font changes applied')

# Guard: principali ripristinati, recapiti ancora grandi.
assert 'className="text-xl font-bold text-gray-900"' in s
assert 'className="rounded bg-red-600 px-2 py-1 text-xs font-bold text-white"' in s
assert 'className="h-12 pl-10"' in s
assert 'text-lg font-medium text-blue-900' in s

p.write_text(s, encoding='utf-8')
