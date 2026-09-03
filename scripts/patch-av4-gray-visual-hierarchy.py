from pathlib import Path

p = Path('src/pages/antiriciclaggio/modello-av4.tsx')
s = p.read_text(encoding='utf-8')

# Outer working area: slightly darker neutral background.
s = s.replace(
    'className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-background"',
    'className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-slate-200/70"',
    1,
)
s = s.replace(
    'className="h-full overflow-y-auto"',
    'className="h-full overflow-y-auto bg-slate-200/70"',
    1,
)

# Main AV4 cards: lighter neutral fill, keeping the blue professional accent.
s = s.replace(
    'className="border border-sky-200 shadow-sm"',
    'className="border border-sky-200 bg-slate-50 shadow-sm"',
)
s = s.replace(
    'className="mt-6 border border-sky-200 shadow-sm"',
    'className="mt-6 border border-sky-200 bg-slate-50 shadow-sm"',
)

# Nested sections: a shade darker than the card, still soft and neutral.
s = s.replace(
    'className="rounded-xl border border-sky-200 bg-white p-5"',
    'className="rounded-xl border border-sky-200 bg-slate-100/60 p-5"',
)
s = s.replace(
    'className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"',
    'className="rounded-xl border border-slate-300 bg-slate-100/70 p-4"',
)
s = s.replace(
    'className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/40 p-4"',
    'className="space-y-4 rounded-xl border border-slate-300 bg-slate-100/70 p-4"',
)

# Informational email block remains neutral, with a clearer border.
s = s.replace(
    'className="rounded-lg border bg-slate-50 p-4"',
    'className="rounded-lg border border-slate-300 bg-slate-100/70 p-4"',
)

# Form controls: white interior + darker neutral border.
replacements = {
    'className="w-full rounded-md border px-3 py-2"':
        'className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"',
    'className="w-full rounded-md border bg-gray-50 px-3 py-2"':
        'className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"',
    'className="rounded-md border px-3 py-2"':
        'className="rounded-md border border-slate-300 bg-white px-3 py-2"',
    'className="w-full rounded border px-3 py-2"':
        'className="w-full rounded border border-slate-300 bg-white px-3 py-2"',
}
for old, new in replacements.items():
    s = s.replace(old, new)

# Safety: styling only. Core functional anchors and new help UI must remain.
required = [
    'function handleChange',
    'async function salvaAV4',
    'async function handleInvioPubblico',
    'TitolariEffettiviForm',
    'AV4HelpButton topic="dati"',
    'AV4HelpButton topic="titolare"',
    'AV4HelpButton topic="firma"',
    'bg-slate-200/70',
    'bg-slate-50 shadow-sm',
    'border-slate-300 bg-white',
]
for marker in required:
    if marker not in s:
        raise SystemExit(f'missing required marker: {marker}')

p.write_text(s, encoding='utf-8')
