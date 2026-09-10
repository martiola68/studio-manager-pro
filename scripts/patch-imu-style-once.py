from pathlib import Path

p = Path('src/pages/scadenze/imu.tsx')
s = p.read_text(encoding='utf-8')
original = s

# 1) Conferma riga = azzurro su TUTTE le celle, compreso blocco dichiarazione.
s = s.replace(
'''  const declarationTone = (
    soggettoImu: boolean | null | undefined,
    conDichiarazione: boolean | null | undefined,
    presentata: boolean | null | undefined,
    rowConfirmed: boolean
  ) => {
    if (!soggettoImu || !conDichiarazione) return "bg-white";
    if (presentata || rowConfirmed) return "bg-blue-100";
    return "bg-white";
  };''',
'''  const declarationTone = (
    soggettoImu: boolean | null | undefined,
    conDichiarazione: boolean | null | undefined,
    presentata: boolean | null | undefined,
    rowConfirmed: boolean
  ) => {
    if (rowConfirmed) return "bg-blue-100";
    if (!soggettoImu || !conDichiarazione) return "bg-white";
    if (presentata) return "bg-blue-100";
    return "bg-white";
  };'''
)

# 2) Le righe divisorie dei record devono essere sky-400 (azzurro più scuro).
s = s.replace('border-b border-sky-300', 'border-b border-sky-400')

# 3) Una riga confermata prevale anche sulla regola Soggetto IMU = NO.
s = s.replace(
'''          className={`border-b border-sky-400 ${
            isNotSubject
              ? "bg-white text-red-600 [&_td]:!bg-white [&_select]:!bg-white [&_select]:!text-red-600 [&_input]:!bg-white [&_input]:!text-red-600 [&_textarea]:!bg-white [&_textarea]:!text-red-600"
              : ""
          }`}''',
'''          className={`border-b border-sky-400 ${
            !isGreenRow && isNotSubject
              ? "bg-white text-red-600 [&_td]:!bg-white [&_select]:!bg-white [&_select]:!text-red-600 [&_input]:!bg-white [&_input]:!text-red-600 [&_textarea]:!bg-white [&_textarea]:!text-red-600"
              : ""
          }`}'''
)

s = s.replace(
'''              isNotSubject ? "!bg-white !text-red-600" : isGreenRow ? "!bg-blue-100" : "!bg-white"''',
'''              isGreenRow ? "!bg-blue-100" : isNotSubject ? "!bg-white !text-red-600" : "!bg-white"'''
)

if s == original:
    raise SystemExit('No IMU changes applied')

required = [
    'border-b border-sky-400',
    'if (rowConfirmed) return "bg-blue-100";',
    'isGreenRow ? "!bg-blue-100" : isNotSubject',
]
for marker in required:
    if marker not in s:
        raise SystemExit(f'Missing IMU final style marker: {marker}')

p.write_text(s, encoding='utf-8')
print('IMU final style: confirmed whole row blue, declaration included, record dividers sky-400')
