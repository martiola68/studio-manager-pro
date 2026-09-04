from pathlib import Path

p = Path('src/pages/scadenze/imu.tsx')
s = p.read_text(encoding='utf-8')
original = s

old_payload = '''      const { error } = await supabase
        .from("tbscadimu")
        .update({ acconto_imu: value, saldo_imu: value })
        .eq("id", scadenza.id);
'''
new_payload = '''      const payload = value
        ? {
            acconto_imu: true,
            saldo_imu: true,
            acconto_dovuto: true,
            saldo_dovuto: true,
          }
        : {
            acconto_imu: false,
            saldo_imu: false,
          };

      const { error } = await supabase
        .from("tbscadimu")
        .update(payload)
        .eq("id", scadenza.id);
'''
if old_payload not in s:
    raise SystemExit('Soggetto IMU payload marker not found')
s = s.replace(old_payload, new_payload, 1)

old_state = '''      setScadenze((prev) =>
        prev.map((row) =>
          row.id === scadenza.id
            ? { ...row, acconto_imu: value, saldo_imu: value }
            : row
        )
      );
'''
new_state = '''      setScadenze((prev) =>
        prev.map((row) =>
          row.id === scadenza.id ? { ...row, ...payload } : row
        )
      );
'''
if old_state not in s:
    raise SystemExit('Soggetto IMU local state marker not found')
s = s.replace(old_state, new_state, 1)

old_tone = '''    if (rowConfirmed) return "bg-green-200";
    if (!enabled) return "bg-slate-200";
    if (completed) return "bg-yellow-200";
    return "bg-orange-200";
'''
new_tone = '''    if (rowConfirmed) return "bg-green-200";
    if (!enabled) return "bg-slate-200";
    if (completed) return "bg-green-200";
    return "bg-orange-300";
'''
if old_tone not in s:
    raise SystemExit('sectionTone marker not found')
s = s.replace(old_tone, new_tone, 1)

old_nom = '''          <td
            className="sticky-col-cell p-2 align-middle font-medium min-w-[320px] border-r border-gray-300 !bg-slate-50"
          >
            {scadenza.nominativo}
          </td>
'''
new_nom = '''          <td
            className={`sticky-col-cell p-2 align-middle font-medium min-w-[320px] border-r border-gray-300 ${
              isGreenRow ? "!bg-green-200" : "!bg-slate-50"
            }`}
          >
            {scadenza.nominativo}
          </td>
'''
if old_nom not in s:
    raise SystemExit('Nominativo marker not found')
s = s.replace(old_nom, new_nom, 1)

required = [
    'acconto_dovuto: true',
    'saldo_dovuto: true',
    'if (completed) return "bg-green-200";',
    'return "bg-orange-300";',
    'isGreenRow ? "!bg-green-200" : "!bg-slate-50"',
    '>Soggetto IMU</th>',
]
for token in required:
    if token not in s:
        raise SystemExit('Verification failed: ' + token)

if s == original:
    raise SystemExit('No changes')

p.write_text(s, encoding='utf-8')
print('IMU final tuning applied')
