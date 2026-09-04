from pathlib import Path

p = Path('src/pages/scadenze/imu.tsx')
s = p.read_text(encoding='utf-8')
original = s

old_tone = '''  const sectionTone = (
    enabled: boolean | null | undefined,
    completed: boolean | null | undefined,
    rowConfirmed: boolean
  ) => {
    if (rowConfirmed) return "bg-green-200";
    if (!enabled) return "bg-slate-200";
    if (completed) return "bg-green-200";
    return "bg-[#fff200]";
  };
'''
new_tone = '''  const sectionTone = (
    enabled: boolean | null | undefined,
    completed: boolean | null | undefined,
    rowConfirmed: boolean
  ) => {
    if (rowConfirmed) return "bg-green-200";
    if (!enabled) return "bg-slate-200";
    if (completed) return "bg-green-200";
    return "bg-red-300";
  };

  const declarationTone = (
    soggettoImu: boolean | null | undefined,
    conDichiarazione: boolean | null | undefined,
    presentata: boolean | null | undefined
  ) => {
    if (!soggettoImu || !conDichiarazione) return "bg-slate-200";
    if (presentata) return "bg-green-200";
    return "bg-red-300";
  };
'''
if old_tone not in s:
    raise SystemExit('sectionTone block not found')
s = s.replace(old_tone, new_tone, 1)

old_decl = 'sectionTone(scadenza.acconto_imu, scadenza.conferma_dichiarazione_imu, isGreenRow)'
new_decl = 'declarationTone(scadenza.acconto_imu, scadenza.dichiarazione_imu, scadenza.conferma_dichiarazione_imu)'
count = s.count(old_decl)
if count != 3:
    raise SystemExit(f'Expected 3 declaration section references, found {count}')
s = s.replace(old_decl, new_decl)

checks = [
    'return "bg-red-300";',
    'const declarationTone = (',
    'if (!soggettoImu || !conDichiarazione) return "bg-slate-200";',
    'if (presentata) return "bg-green-200";',
    'declarationTone(scadenza.acconto_imu, scadenza.dichiarazione_imu, scadenza.conferma_dichiarazione_imu)',
]
for token in checks:
    if token not in s:
        raise SystemExit('Verification failed: ' + token)
if 'bg-[#fff200]' in s:
    raise SystemExit('Old yellow tone still present')
if s == original:
    raise SystemExit('No changes')

p.write_text(s, encoding='utf-8')
print('IMU red/declaration patch applied')
