from pathlib import Path
import re

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

changed = []
for name in files:
    p = Path(name)
    s = p.read_text(encoding='utf-8')
    old = s

    # Solo separatori orizzontali delle righe dati: sostituisce le tonalità
    # grigie/slate già usate come border-bottom con il blu scuro dell'header.
    s = re.sub(r'border-b border-(?:gray|slate)-(?:200|300|400|500)',
               'border-b border-slate-600', s)
    s = re.sub(r'border-(?:gray|slate)-(?:200|300|400|500) border-b',
               'border-slate-600 border-b', s)

    # TableRow shadcn può avere il solo border-b ereditato: lo rende scuro
    # esclusivamente nei tag di riga che contengono già il separatore.
    s = re.sub(r'(<TableRow\b[^>]*className="[^"]*)\bborder-b\b(?![^\"]*border-(?:slate|gray|blue)-)',
               r'\1border-b border-slate-600', s)
    s = re.sub(r'(<tr\b[^>]*className="[^"]*)\bborder-b\b(?![^\"]*border-(?:slate|gray|blue)-)',
               r'\1border-b border-slate-600', s)

    if s != old:
        p.write_text(s, encoding='utf-8')
        changed.append(name)

print('Modificati:', *changed, sep='\n- ')
if not changed:
    raise SystemExit('Nessun separatore righe trovato da modificare')
