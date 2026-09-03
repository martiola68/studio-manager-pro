from pathlib import Path

paths = [
    Path('src/pages/antiriciclaggio/modello-av1.tsx'),
    Path('src/pages/antiriciclaggio/modello-av2.tsx'),
    Path('src/pages/antiriciclaggio/modello-av4.tsx'),
]

for path in paths:
    s = path.read_text(encoding='utf-8')
    original = s

    # Repair the AV1 signed-file Input produced by the previous styling pass:
    # JSX cannot contain two className attributes on the same element.
    s = s.replace(
        '''<Input\n        className="border-slate-400 bg-white"\n  type="text"\n  readOnly\n  value={formData.allegato_av1_firmato || ""}\n  placeholder="Nessun file allegato"\n  className="cursor-default"\n/>''',
        '''<Input\n  type="text"\n  readOnly\n  value={formData.allegato_av1_firmato || ""}\n  placeholder="Nessun file allegato"\n  className="cursor-default border-slate-300 bg-white"\n/>''',
    )
    s = s.replace(
        '''<Input\n        className="border-slate-300 bg-white"\n  type="text"\n  readOnly\n  value={formData.allegato_av1_firmato || ""}\n  placeholder="Nessun file allegato"\n  className="cursor-default"\n/>''',
        '''<Input\n  type="text"\n  readOnly\n  value={formData.allegato_av1_firmato || ""}\n  placeholder="Nessun file allegato"\n  className="cursor-default border-slate-300 bg-white"\n/>''',
    )

    # Same body tone on all three AML forms.
    s = s.replace('bg-slate-300', 'bg-slate-200/70')
    s = s.replace(
        'className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-background"',
        'className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-slate-200/70"',
    )

    # Actual visible body + top strip under sticky header.
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

    # Main cards and nested cards.
    s = s.replace(
        'className="border border-sky-200 bg-slate-100 shadow-sm"',
        'className="border border-sky-200 bg-slate-50 shadow-sm"',
    )
    s = s.replace(
        'className="mt-6 border border-sky-200 bg-slate-100 shadow-sm"',
        'className="mt-6 border border-sky-200 bg-slate-50 shadow-sm"',
    )
    s = s.replace('bg-slate-200/70 p-4', 'bg-slate-100/70 p-4')
    s = s.replace('bg-slate-200/70 p-5', 'bg-slate-100/70 p-5')
    s = s.replace('bg-slate-200/70 px-4 py-3', 'bg-slate-100/70 px-4 py-3')
    s = s.replace('border-slate-400 bg-white', 'border-slate-300 bg-white')

    if path.name == 'modello-av1.tsx':
        bad = '''placeholder="Nessun file allegato"\n  className="cursor-default"'''
        if bad in s and 'className="border-slate-300 bg-white"' in s:
            raise SystemExit('AV1 still contains the duplicate className pattern')

    required = [
        'bg-slate-200/70',
        'border-t border-slate-200 bg-slate-200/70',
        'h-full overflow-y-auto bg-slate-200/70',
    ]
    for marker in required:
        if marker not in s:
            raise SystemExit(f'{path}: missing marker {marker}')

    path.write_text(s, encoding='utf-8')
    print(f'Patched {path}' + (' (changed)' if s != original else ' (already aligned)'))
