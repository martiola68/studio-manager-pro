from pathlib import Path

files = [
    'src/components/scadenze/iva/IvaScrollableTable.tsx',
    'src/pages/scadenze/ccgg.tsx',
    'src/pages/scadenze/cu.tsx',
    'src/pages/scadenze/imu.tsx',
    'src/pages/scadenze/fiscali.tsx',
    'src/pages/scadenze/bilanci.tsx',
    'src/pages/scadenze/modello-770.tsx',
    'src/pages/scadenze/lipe.tsx',
    'src/pages/scadenze/esterometro.tsx',
]

for name in files:
    p = Path(name)
    s = p.read_text(encoding='utf-8')
    old = s
    s = s.replace('bg-orange-300 hover:bg-orange-300', 'bg-white hover:bg-white')
    s = s.replace('!bg-orange-300', '!bg-white')
    s = s.replace('bg-orange-300 text-slate-900', 'bg-white text-slate-700')
    s = s.replace('border-orange-400 bg-white text-slate-700', 'border-slate-300 bg-white text-slate-700')
    s = s.replace('bg-orange-300', 'bg-white')
    s = s.replace('#fdba74', '#ffffff')
    if s != old:
        p.write_text(s, encoding='utf-8')

# Verify only the orange introduced by the confirmation patch is gone from runtime targets.
for name in files:
    s = Path(name).read_text(encoding='utf-8')
    if 'bg-orange-300' in s or '#fdba74' in s:
        raise SystemExit(f'orange confirmation color remains in {name}')
