from pathlib import Path

FILES = [
    Path('src/pages/antiriciclaggio/modello-av1.tsx'),
    Path('src/pages/antiriciclaggio/modello-av2.tsx'),
]

for path in FILES:
    s = path.read_text(encoding='utf-8')
    original = s

    # Page shell: darker neutral canvas, as requested for AV4.
    s = s.replace(
        'className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-background"',
        'className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-slate-300"'
    )

    # Main cards: lighter neutral fill + blue outline.
    s = s.replace('<Card>', '<Card className="border-sky-300 bg-slate-100 shadow-sm">')
    s = s.replace('className="rounded-lg border bg-card', 'className="rounded-lg border border-sky-300 bg-slate-100')
    s = s.replace('className="rounded-lg border bg-white', 'className="rounded-lg border border-sky-300 bg-slate-100')

    # Nested sections: intermediate grey, without changing structure/handlers.
    s = s.replace('className="rounded-lg border p-4', 'className="rounded-lg border border-slate-300 bg-slate-200 p-4')
    s = s.replace('className="rounded-md border p-4', 'className="rounded-md border border-slate-300 bg-slate-200 p-4')
    s = s.replace('className="rounded-lg border p-5', 'className="rounded-lg border border-slate-300 bg-slate-200 p-5')
    s = s.replace('className="rounded-md border p-3', 'className="rounded-md border border-slate-300 bg-slate-200 p-3')

    # Inputs/selects/textareas: white inside, darker neutral border.
    # Preserve semantic risk backgrounds by only styling neutral controls.
    s = s.replace('className="w-full rounded-md border px-3 py-2', 'className="w-full rounded-md border border-slate-400 bg-white px-3 py-2')
    s = s.replace('className="w-full rounded border px-3 py-2', 'className="w-full rounded border border-slate-400 bg-white px-3 py-2')
    s = s.replace('className="w-full border rounded-md px-3 py-2', 'className="w-full border border-slate-400 bg-white rounded-md px-3 py-2')
    s = s.replace('className="rounded-md border px-3 py-2', 'className="rounded-md border border-slate-400 bg-white px-3 py-2')
    s = s.replace('className="rounded border px-2 py-1', 'className="rounded border border-slate-400 bg-white px-2 py-1')
    s = s.replace('className="min-h-[', 'className="border-slate-400 bg-white min-h-[')

    # shadcn Input component: add neutral visual treatment where no className existed.
    s = s.replace('<Input\n', '<Input\n        className="border-slate-400 bg-white"\n')

    if s == original:
        raise SystemExit(f'No visual replacements matched in {path}')

    path.write_text(s, encoding='utf-8')
    print(f'Patched {path}')
