from pathlib import Path

p = Path('src/pages/scadenze/imu.tsx')
s = p.read_text(encoding='utf-8')
original = s

# SOLO divisori orizzontali record: stesso blu scuro dell'header tabella.
for old in ('border-b border-sky-400', 'border-b border-slate-600', 'border-b border-[#2563eb]'):
    s = s.replace(old, 'border-b border-[#415a77]')

if s == original:
    raise SystemExit('No IMU separator changes applied')
if 'border-b border-[#415a77]' not in s:
    raise SystemExit('Dark header-blue separator missing')

p.write_text(s, encoding='utf-8')
print('IMU record separators changed to header blue #415a77')
