from pathlib import Path

FILES = [
    Path('src/pages/antiriciclaggio/modello-av1.tsx'),
    Path('src/pages/antiriciclaggio/modello-av2.tsx'),
]

for path in FILES:
    s = path.read_text(encoding='utf-8')
    original = s

    # Same hierarchy used by the final AV4 styling: slate-300 canvas,
    # slate-100 main cards, slate-200/70 inner cards, white controls.
    s = s.replace(
        'className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-background"',
        'className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-slate-300"'
    )

    # Main cards, including cards that already carry spacing classes.
    s = s.replace('<Card>', '<Card className="border border-sky-200 bg-slate-100 shadow-sm">')
    s = s.replace('<Card className="mt-6">', '<Card className="mt-6 border border-sky-200 bg-slate-100 shadow-sm">')
    s = s.replace('<Card className="border-sky-300 bg-slate-100 shadow-sm">', '<Card className="border border-sky-200 bg-slate-100 shadow-sm">')

    # Inner neutral blocks/cards. Dynamic semantic red states remain untouched.
    s = s.replace('className="grid grid-cols-12 gap-3 rounded-lg border p-4"', 'className="grid grid-cols-12 gap-3 rounded-lg border border-slate-300 bg-slate-200/70 p-4"')
    s = s.replace('className={`rounded-lg border p-4 ${', 'className={`rounded-lg border border-slate-300 bg-slate-200/70 p-4 ${')
    s = s.replace('className="rounded-lg border p-4', 'className="rounded-lg border border-slate-300 bg-slate-200/70 p-4')
    s = s.replace('className="rounded-md border p-4', 'className="rounded-md border border-slate-300 bg-slate-200/70 p-4')
    s = s.replace('className="rounded-lg border p-5', 'className="rounded-lg border border-slate-300 bg-slate-200/70 p-5')
    s = s.replace('className="rounded-md border p-3', 'className="rounded-md border border-slate-300 bg-slate-200/70 p-3')
    s = s.replace('className="rounded-md border bg-gray-50 px-4 py-3', 'className="rounded-md border border-slate-300 bg-slate-200/70 px-4 py-3')

    # Neutral controls: darker border and fully white interior.
    s = s.replace('border-slate-300 bg-white', 'border-slate-400 bg-white')
    s = s.replace('className="w-full rounded-md border px-3 py-2', 'className="w-full rounded-md border border-slate-400 bg-white px-3 py-2')
    s = s.replace('className="w-full rounded border px-3 py-2', 'className="w-full rounded border border-slate-400 bg-white px-3 py-2')
    s = s.replace('className="w-full border rounded-md px-3 py-2', 'className="w-full border border-slate-400 bg-white rounded-md px-3 py-2')
    s = s.replace('className="rounded-md border px-3 py-2', 'className="rounded-md border border-slate-400 bg-white px-3 py-2')
    s = s.replace('className="rounded border px-2 py-1', 'className="rounded border border-slate-400 bg-white px-2 py-1')
    s = s.replace('className="w-full rounded-md border bg-gray-100 px-3 py-2"', 'className="w-full rounded-md border border-slate-400 bg-white px-3 py-2"')

    # Keep AV1 semantic risk colors and the blue score selector unchanged.

    if s == original:
        raise SystemExit(f'No additional visual replacements matched in {path}')

    required = ['bg-slate-300', 'bg-slate-100 shadow-sm', 'border-slate-400 bg-white']
    for marker in required:
        if marker not in s:
            raise SystemExit(f'{path}: missing visual marker {marker}')

    path.write_text(s, encoding='utf-8')
    print(f'Patched {path}')
