from pathlib import Path

paths = [
    Path('src/pages/antiriciclaggio/modello-av1.tsx'),
    Path('src/pages/antiriciclaggio/modello-av2.tsx'),
    Path('src/pages/antiriciclaggio/modello-av4.tsx'),
]

for path in paths:
    s = path.read_text(encoding='utf-8')
    original = s

    # Same body tone on all three AML forms.
    s = s.replace('bg-slate-300', 'bg-slate-200/70')
    s = s.replace(
        'className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-background"',
        'className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-slate-200/70"',
    )

    # The actual visible body + top strip under the sticky header must use the same grey.
    s = s.replace(
        'className="flex-1 overflow-hidden"',
        'className="flex-1 overflow-hidden border-t border-slate-200 bg-slate-200/70"',
        1,
    )
    s = s.replace(
        'className="h-full overflow-y-auto"',
        'className="h-full overflow-y-auto bg-slate-200/70"',
        1,
    )

    # Main cards: exact AV4 treatment.
    s = s.replace(
        'className="border border-sky-200 bg-slate-100 shadow-sm"',
        'className="border border-sky-200 bg-slate-50 shadow-sm"',
    )
    s = s.replace(
        'className="mt-6 border border-sky-200 bg-slate-100 shadow-sm"',
        'className="mt-6 border border-sky-200 bg-slate-50 shadow-sm"',
    )

    # Nested neutral cards: intermediate grey like AV4.
    s = s.replace('bg-slate-200/70 p-4', 'bg-slate-100/70 p-4')
    s = s.replace('bg-slate-200/70 p-5', 'bg-slate-100/70 p-5')
    s = s.replace('bg-slate-200/70 px-4 py-3', 'bg-slate-100/70 px-4 py-3')

    # Neutral controls: exact AV4 white field + slate-300 border.
    s = s.replace('border-slate-400 bg-white', 'border-slate-300 bg-white')

    if path.name in {'modello-av1.tsx', 'modello-av2.tsx'} and s == original:
        raise SystemExit(f'No visual changes produced in {path}')

    required = [
        'bg-slate-200/70',
        'border-t border-slate-200 bg-slate-200/70',
        'h-full overflow-y-auto bg-slate-200/70',
    ]
    for marker in required:
        if marker not in s:
            raise SystemExit(f'{path}: missing marker {marker}')

    path.write_text(s, encoding='utf-8')
    print(f'Patched {path}')
