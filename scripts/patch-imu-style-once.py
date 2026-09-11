from pathlib import Path

p = Path('src/pages/scadenze/imu.tsx')
s = p.read_text(encoding='utf-8')
original = s

# Unica modifica richiesta: divisori orizzontali dei record in blu scuro.
# Usiamo un colore esplicito per evitare le tonalita celesti della palette sky.
s = s.replace('border-b border-sky-400', 'border-b border-[#2563eb]')
s = s.replace('border-b border-slate-600', 'border-b border-[#2563eb]')

if s == original:
    raise SystemExit('No IMU separator changes applied')

if 'border-b border-[#2563eb]' not in s:
    raise SystemExit('Dark blue separator missing')

p.write_text(s, encoding='utf-8')
print('IMU record separators changed to dark blue #2563eb')
