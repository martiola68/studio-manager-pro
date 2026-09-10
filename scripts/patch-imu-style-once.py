from pathlib import Path

p = Path('src/pages/scadenze/imu.tsx')
s = p.read_text(encoding='utf-8')
original = s

old_helpers = '''  const sectionTone = (
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

  const rowSideTone = (rowConfirmed: boolean) =>
    rowConfirmed ? "bg-blue-100" : "bg-white";'''

new_helpers = '''  const sectionTone = (
    enabled: boolean | null | undefined,
    completed: boolean | null | undefined,
    rowConfirmed: boolean
  ) => {
    if (!enabled) return "bg-white";
    if (completed || rowConfirmed) return "bg-blue-100";
    return "bg-white";
  };

  const declarationTone = (
    soggettoImu: boolean | null | undefined,
    conDichiarazione: boolean | null | undefined,
    presentata: boolean | null | undefined,
    rowConfirmed: boolean
  ) => {
    if (!soggettoImu || !conDichiarazione) return "bg-white";
    if (presentata || rowConfirmed) return "bg-blue-100";
    return "bg-white";
  };

  const rowSideTone = (rowConfirmed: boolean) =>
    rowConfirmed ? "bg-blue-100" : "bg-white";'''

if old_helpers not in s:
    raise SystemExit('IMU helper style block not found')
s = s.replace(old_helpers, new_helpers, 1)

s = s.replace('className="border-b border-slate-600"', 'className="border-b border-sky-300"')
s = s.replace('<tr className="border-b border-slate-600">', '<tr className="border-b border-sky-300">')

s = s.replace('''      return (
        <tr
          key={scadenza.id}
          className="border-b border-sky-300"
        >''', '''      const isNotSubject = scadenza.soggetto_imu === false;

      return (
        <tr
          key={scadenza.id}
          className={`border-b border-sky-300 ${
            isNotSubject
              ? "bg-white text-red-600 [&_td]:!bg-white [&_select]:!bg-white [&_select]:!text-red-600 [&_input]:!bg-white [&_input]:!text-red-600 [&_textarea]:!bg-white [&_textarea]:!text-red-600"
              : ""
          }`}
        >''', 1)

s = s.replace('''              isGreenRow ? "!bg-blue-100" : "!bg-white"
            }`}''', '''              isNotSubject ? "!bg-white !text-red-600" : isGreenRow ? "!bg-blue-100" : "!bg-white"
            }`}''', 1)

# Declaration cells: pass row confirmation so a confirmed row is uniformly blue unless Soggetto IMU = NO.
s = s.replace('declarationTone(scadenza.soggetto_imu, scadenza.dichiarazione_imu, scadenza.conferma_dichiarazione_imu)', 'declarationTone(scadenza.soggetto_imu, scadenza.dichiarazione_imu, scadenza.conferma_dichiarazione_imu, isGreenRow)')

# Remove residual colored disabled controls: cells manage status color; disabled controls stay white.
s = s.replace('disabled:bg-slate-100 disabled:text-slate-400', 'disabled:bg-white disabled:text-slate-400')
s = s.replace('disabled:bg-slate-100 disabled:text-slate-500', 'disabled:bg-white disabled:text-slate-500')

# Remove residual semantic green text from the communication helper label.
s = s.replace('text-xs text-green-600 font-semibold', 'text-xs text-blue-700 font-semibold')

if s == original:
    raise SystemExit('No IMU changes applied')

for forbidden in ['bg-green-200', 'bg-red-300', 'bg-slate-200']:
    if forbidden in s:
        raise SystemExit(f'Residual IMU cell color found: {forbidden}')

required = [
    'border-b border-sky-300',
    '[&_select]:!text-red-600',
    'if (completed || rowConfirmed) return "bg-blue-100";',
    'if (presentata || rowConfirmed) return "bg-blue-100";',
]
for marker in required:
    if marker not in s:
        raise SystemExit(f'Missing IMU style marker: {marker}')

p.write_text(s, encoding='utf-8')
print('IMU style updated: blue confirmed/completed blocks, white-red non-subject rows, blue dividers')
