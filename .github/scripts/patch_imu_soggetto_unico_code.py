from pathlib import Path
import re

files = {
    'imu': Path('src/pages/scadenze/imu.tsx'),
    'alerts': Path('src/services/scadenzaAlertService.ts'),
    'types1': Path('src/lib/supabase/database.types.ts'),
    'types2': Path('src/integrations/supabase/database.types.ts'),
}

# --- IMU page ---
p = files['imu']
s = p.read_text(encoding='utf-8')
original = s

# Replace only standalone DB field tokens, never conferma_acconto_imu/conferma_saldo_imu.
s = re.sub(r'\bacconto_imu\b', 'soggetto_imu', s)

# Remove obsolete saldo_imu assignments left in the Soggetto IMU handler.
s = re.sub(r'^\s*saldo_imu:\s*(?:true|false|value),\s*\n', '', s, flags=re.M)

# The Soggetto handler must persist the single subject flag and default both due flags to true.
if 'soggetto_imu: true' not in s or 'acconto_dovuto: true' not in s or 'saldo_dovuto: true' not in s:
    raise SystemExit('IMU subject handler verification failed')
if re.search(r'\bsaldo_imu\b', s):
    raise SystemExit('Obsolete saldo_imu still present in imu.tsx')
if re.search(r'\bacconto_imu\b', s):
    raise SystemExit('Obsolete acconto_imu still present in imu.tsx')

p.write_text(s, encoding='utf-8')

# --- Alert service ---
p = files['alerts']
s = p.read_text(encoding='utf-8')

s = s.replace(
    '            acconto_imu, acconto_dovuto, acconto_comunicato,\n            saldo_imu, saldo_dovuto, saldo_comunicato,',
    '            soggetto_imu, acconto_dovuto, acconto_comunicato,\n            saldo_dovuto, saldo_comunicato,',
)
s = s.replace('.eq("acconto_imu", true)', '.eq("soggetto_imu", true)')
s = s.replace('.eq("saldo_imu", true)', '.eq("soggetto_imu", true)')

if 'soggetto_imu, acconto_dovuto' not in s:
    raise SystemExit('Alert select verification failed')
if re.search(r'\.eq\("(?:acconto_imu|saldo_imu)"', s):
    raise SystemExit('Old IMU alert filter still present')

p.write_text(s, encoding='utf-8')

# --- Generated Supabase type snapshots ---
for key in ('types1', 'types2'):
    p = files[key]
    s = p.read_text(encoding='utf-8')

    # Exact property names only.
    s = re.sub(r'(^\s*)acconto_imu(\??):', r'\1soggetto_imu\2:', s, flags=re.M)
    s = re.sub(r'^\s*saldo_imu\??:\s*boolean\s*\|\s*null\s*\n', '', s, flags=re.M)

    if re.search(r'^\s*acconto_imu\??:', s, flags=re.M):
        raise SystemExit(f'Old acconto_imu property still present in {p}')
    if re.search(r'^\s*saldo_imu\??:', s, flags=re.M):
        raise SystemExit(f'Old saldo_imu property still present in {p}')
    if 'soggetto_imu' not in s:
        raise SystemExit(f'soggetto_imu missing in {p}')

    p.write_text(s, encoding='utf-8')

print('Aligned IMU runtime, alert service and Supabase types to soggetto_imu')
