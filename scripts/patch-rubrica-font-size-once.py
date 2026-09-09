from pathlib import Path

p = Path('src/pages/contatti/index.tsx')
s = p.read_text(encoding='utf-8')
old = s

replacements = {
    'className="flex items-center justify-between text-xl"': 'className="flex items-center justify-between text-2xl"',
    'className="rounded-full bg-blue-700 px-3 py-1 text-sm font-semibold text-white"': 'className="rounded-full bg-blue-700 px-3 py-1 text-base font-semibold text-white"',
    'className="flex flex-wrap gap-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-base text-blue-900"': 'className="flex flex-wrap gap-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-lg font-medium text-blue-900"',
    'className="text-xl font-bold text-gray-900"': 'className="text-2xl font-bold text-gray-900"',
    'className="mt-2 grid grid-cols-1 gap-3 text-base text-gray-700 md:grid-cols-3"': 'className="mt-2 grid grid-cols-1 gap-3 text-lg text-gray-700 md:grid-cols-3"',
    'className="rounded bg-red-600 px-2 py-1 text-xs font-bold text-white"': 'className="rounded bg-red-600 px-2 py-1 text-sm font-bold text-white"',
    'className="h-12 pl-10"': 'className="h-12 pl-10 text-lg"',
}

for old_text, new_text in replacements.items():
    if old_text in s:
        s = s.replace(old_text, new_text)

if s == old:
    raise SystemExit('no matching Rubrica font classes found')

# Guard: main Rubrica rendering must now expose larger typography.
assert 'text-2xl font-bold text-gray-900' in s
assert 'text-lg font-medium text-blue-900' in s
assert 'h-12 pl-10 text-lg' in s

p.write_text(s, encoding='utf-8')
