from pathlib import Path

p = Path('src/pages/scadenze/imu.tsx')
s = p.read_text(encoding='utf-8')
original = s

# Unica modifica richiesta: usa lo stesso divisore record dello Scadenzario IVA.
s = s.replace('border-b border-sky-400', 'border-b border-slate-600')

if s == original:
    raise SystemExit('No IMU separator changes applied')

if 'border-b border-sky-400' in s:
    raise SystemExit('Residual sky-400 separator found')
if 'border-b border-slate-600' not in s:
    raise SystemExit('IVA-style slate-600 separator missing')

p.write_text(s, encoding='utf-8')
print('IMU record separators now match IVA: border-slate-600')
