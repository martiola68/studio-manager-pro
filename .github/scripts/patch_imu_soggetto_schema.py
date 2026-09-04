from pathlib import Path

# Runtime IMU
p = Path('src/pages/scadenze/imu.tsx')
s = p.read_text(encoding='utf-8')
s = s.replace('acconto_imu', 'soggetto_imu')
s = s.replace('            saldo_imu: true,\n', '')
s = s.replace('            saldo_imu: false,\n', '')
p.write_text(s, encoding='utf-8')

# Alert service: use the single subject flag for both acconto and saldo.
p = Path('src/services/scadenzaAlertService.ts')
s = p.read_text(encoding='utf-8')
s = s.replace('acconto_imu, acconto_dovuto, acconto_comunicato,\n            saldo_imu, saldo_dovuto, saldo_comunicato,',
              'soggetto_imu, acconto_dovuto, acconto_comunicato,\n            saldo_dovuto, saldo_comunicato,')
s = s.replace('.eq("acconto_imu", true)', '.eq("soggetto_imu", true)')
s = s.replace('.eq("saldo_imu", true)', '.eq("soggetto_imu", true)')
p.write_text(s, encoding='utf-8')

# Generated Supabase types: rename acconto_imu -> soggetto_imu and remove saldo_imu.
for filename in [
    'src/integrations/supabase/database.types.ts',
    'src/lib/supabase/database.types.ts',
]:
    p = Path(filename)
    s = p.read_text(encoding='utf-8')
    s = s.replace('acconto_imu', 'soggetto_imu')
    lines = [line for line in s.splitlines() if 'saldo_imu:' not in line]
    p.write_text('\n'.join(lines) + '\n', encoding='utf-8')

# Guardrails on active runtime code.
imu = Path('src/pages/scadenze/imu.tsx').read_text(encoding='utf-8')
alerts = Path('src/services/scadenzaAlertService.ts').read_text(encoding='utf-8')
assert 'soggetto_imu' in imu
assert 'acconto_imu' not in imu
assert 'saldo_imu' not in imu
assert '.eq("soggetto_imu", true)' in alerts
assert 'acconto_imu' not in alerts
assert 'saldo_imu' not in alerts
print('IMU runtime and alert service aligned to soggetto_imu')
