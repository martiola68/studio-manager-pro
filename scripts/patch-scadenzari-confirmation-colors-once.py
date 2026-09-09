from pathlib import Path

BLUE = 'bg-blue-100 hover:bg-blue-100'
ORANGE = 'bg-orange-300 hover:bg-orange-300'

changed = []

def patch(path, replacements):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    original = s
    for old, new in replacements:
        s = s.replace(old, new)
    if s != original:
        p.write_text(s, encoding='utf-8')
        changed.append(path)

# IVA: conferma SI azzurrino; conferma NO arancio. Il colore della riga non dipende piu' da mod_definitivo.
patch('src/components/scadenze/iva/IvaScrollableTable.tsx', [
    ('''scadenza.conferma_riga
                        ? "bg-green-100 hover:bg-green-100"
                        : scadenza.mod_definitivo
                        ? "bg-orange-100 hover:bg-orange-100"
                        : "bg-slate-50 hover:bg-slate-100"''',
     '''scadenza.conferma_riga
                        ? "bg-blue-100 hover:bg-blue-100"
                        : "bg-orange-300 hover:bg-orange-300"'''),
    ('scadenza.conferma_riga ? "!bg-green-100" : scadenza.mod_definitivo ? "!bg-orange-100" : "!bg-slate-50"',
     'scadenza.conferma_riga ? "!bg-blue-100" : "!bg-orange-300"'),
])

# CCGG
patch('src/pages/scadenze/ccgg.tsx', [
    ('isGreenRow ? "bg-green-300 hover:bg-green-300" : "bg-slate-50 hover:bg-slate-100"',
     'isGreenRow ? "bg-blue-100 hover:bg-blue-100" : "bg-orange-300 hover:bg-orange-300"'),
    ('isGreenRow ? "!bg-green-300" : "!bg-slate-50"',
     'isGreenRow ? "!bg-blue-100" : "!bg-orange-300"'),
])

# CU: conserva il grigio delle righe non applicabili; sulle righe applicabili SI=azzurro, NO=arancio.
patch('src/pages/scadenze/cu.tsx', [
    ('? "bg-green-300 hover:bg-green-300"\n                            : "bg-slate-50 hover:bg-slate-100"',
     '? "bg-blue-100 hover:bg-blue-100"\n                            : "bg-orange-300 hover:bg-orange-300"'),
    ('isGreenRow ? "!bg-green-300" : "!bg-slate-50"',
     'isGreenRow ? "!bg-blue-100" : "!bg-orange-300"'),
])

# IMU: solo tonalita laterale collegata alla conferma riga; non tocca i colori delle sezioni IMU.
patch('src/pages/scadenze/imu.tsx', [
    ('rowConfirmed ? "bg-green-200" : "bg-slate-50"',
     'rowConfirmed ? "bg-blue-100" : "bg-orange-300"'),
    ('isGreenRow ? "!bg-green-200" : "!bg-slate-50"',
     'isGreenRow ? "!bg-blue-100" : "!bg-orange-300"'),
])

# Fiscali
patch('src/pages/scadenze/fiscali.tsx', [
    ('? "bg-green-100 hover:bg-green-200"\n                          : "bg-slate-50 hover:bg-slate-100"',
     '? "bg-blue-100 hover:bg-blue-100"\n                          : "bg-orange-300 hover:bg-orange-300"'),
    ('? "#dcfce7"\n                            : "#f8fafc"',
     '? "#dbeafe"\n                            : "#fdba74"'),
])

# Bilanci
patch('src/pages/scadenze/bilanci.tsx', [
    ('? "bg-green-200 hover:bg-green-200"\n                          : "bg-slate-50 hover:bg-slate-100"',
     '? "bg-blue-100 hover:bg-blue-100"\n                          : "bg-orange-300 hover:bg-orange-300"'),
    ('scadenza.conferma_riga ? "!bg-green-200" : "!bg-slate-50"',
     'scadenza.conferma_riga ? "!bg-blue-100" : "!bg-orange-300"'),
])

# 770
patch('src/pages/scadenze/modello-770.tsx', [
    ('? "bg-green-200 hover:bg-green-200"\n                            : "bg-slate-50 hover:bg-slate-100"',
     '? "bg-blue-100 hover:bg-blue-100"\n                            : "bg-orange-300 hover:bg-orange-300"'),
    ('? "#bbf7d0"\n                              : "#f8fafc"',
     '? "#dbeafe"\n                              : "#fdba74"'),
])

# LIPE: i selettori SI/NO usano la stessa palette richiesta. Cambia solo la resa cromatica.
p = Path('src/pages/scadenze/lipe.tsx')
s = p.read_text(encoding='utf-8')
original = s
s = s.replace('''  const isGreen = highlight || (monthStatus && value && !disabled);''',
              '''  const isGreen = highlight || (monthStatus && value && !disabled);''')
s = s.replace('''        isGreen
          ? "border-green-300 bg-green-200 text-slate-900"
          : "border-slate-300 bg-white text-slate-700"''',
              '''        value
          ? "border-blue-300 bg-blue-100 text-slate-900"
          : "border-orange-400 bg-orange-300 text-slate-900"''')
if s != original:
    p.write_text(s, encoding='utf-8')
    changed.append(str(p))

# Esterometro: stato mensile SI/inviato azzurro, NO/non inviato arancio.
patch('src/pages/scadenze/esterometro.tsx', [
    ('const monthBgClass = isInviato\n                          ? "bg-green-100"\n                          : "bg-slate-50";',
     'const monthBgClass = isInviato\n                          ? "bg-blue-100"\n                          : "bg-orange-300";'),
])

expected = {
    'src/components/scadenze/iva/IvaScrollableTable.tsx',
    'src/pages/scadenze/ccgg.tsx',
    'src/pages/scadenze/cu.tsx',
    'src/pages/scadenze/imu.tsx',
    'src/pages/scadenze/fiscali.tsx',
    'src/pages/scadenze/bilanci.tsx',
    'src/pages/scadenze/modello-770.tsx',
    'src/pages/scadenze/lipe.tsx',
    'src/pages/scadenze/esterometro.tsx',
}

missing = expected - set(changed)
if missing:
    raise SystemExit('Nessuna modifica applicata a: ' + ', '.join(sorted(missing)))

print('Modificati:', *changed, sep='\n- ')
