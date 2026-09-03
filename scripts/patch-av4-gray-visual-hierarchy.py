from pathlib import Path

p = Path('src/pages/antiriciclaggio/modello-av4.tsx')
s = p.read_text(encoding='utf-8')

# Stronger visual hierarchy, styling only.
s = s.replace('bg-slate-200/70', 'bg-slate-300', 2)
s = s.replace('border border-sky-200 bg-slate-50 shadow-sm', 'border border-sky-200 bg-slate-100 shadow-sm')
s = s.replace('mt-6 border border-sky-200 bg-slate-50 shadow-sm', 'mt-6 border border-sky-200 bg-slate-100 shadow-sm')
s = s.replace('rounded-xl border border-sky-200 bg-slate-100/60 p-5', 'rounded-xl border border-sky-200 bg-slate-200/70 p-5')
s = s.replace('rounded-xl border border-slate-300 bg-slate-100/70 p-4', 'rounded-xl border border-slate-300 bg-slate-200/70 p-4')
s = s.replace('space-y-4 rounded-xl border border-slate-300 bg-slate-100/70 p-4', 'space-y-4 rounded-xl border border-slate-300 bg-slate-200/70 p-4')
s = s.replace('rounded-lg border border-slate-300 bg-slate-100/70 p-4', 'rounded-lg border border-slate-300 bg-slate-200/70 p-4')
s = s.replace('border border-slate-300 bg-white', 'border border-slate-400 bg-white')
s = s.replace('border-slate-300 bg-white', 'border-slate-400 bg-white')

required = [
    'function handleChange',
    'async function salvaAV4',
    'async function handleInvioPubblico',
    'TitolariEffettiviForm',
    'AV4HelpButton topic="dati"',
    'AV4HelpButton topic="titolare"',
    'AV4HelpButton topic="firma"',
    'bg-slate-300',
    'bg-slate-100 shadow-sm',
    'bg-slate-200/70',
    'border-slate-400 bg-white',
]
for marker in required:
    if marker not in s:
        raise SystemExit(f'missing required marker: {marker}')

p.write_text(s, encoding='utf-8')
