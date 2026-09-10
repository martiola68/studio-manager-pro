from pathlib import Path

p = Path('src/pages/scadenze/cu.tsx')
s = p.read_text(encoding='utf-8')
original = s

old_row = '''className={`border-b border-slate-600 transition-colors data-[state=selected]:bg-muted ${
                          isGrayRow
                            ? "bg-gray-200 hover:bg-gray-200"
                            : isGreenRow
                            ? "bg-blue-100 hover:bg-blue-100"
                            : "bg-white hover:bg-white"
                        }`}'''
new_row = '''className={`border-b border-slate-600 transition-colors data-[state=selected]:bg-muted ${
                          isGreenRow
                            ? "bg-blue-100 hover:bg-blue-100"
                            : "bg-white hover:bg-white"
                        } ${
                          isGrayRow
                            ? "text-red-600 [&_select]:!text-red-600 [&_input]:!text-red-600"
                            : ""
                        }`}'''

old_sticky = '''className={`px-2 py-1 align-middle sticky-col-cell border-r font-medium min-w-[260px] ${
                            isGrayRow
                              ? "!bg-gray-200"
                              : isGreenRow
                              ? "!bg-green-300"
                              : "!bg-slate-50"
                          }`}'''
new_sticky = '''className={`px-2 py-1 align-middle sticky-col-cell border-r font-medium min-w-[260px] ${
                            isGreenRow
                              ? "!bg-blue-100"
                              : "!bg-white"
                          } ${isGrayRow ? "!text-red-600" : ""}`}'''

if old_row not in s:
    raise SystemExit('CU row style marker not found')
if old_sticky not in s:
    raise SystemExit('CU sticky cell style marker not found')

s = s.replace(old_row, new_row, 1)
s = s.replace(old_sticky, new_sticky, 1)

if s == original:
    raise SystemExit('No CU changes applied')

if 'bg-gray-200 hover:bg-gray-200' in s:
    raise SystemExit('Gray CU row background still present')
if '!bg-green-300' in s:
    raise SystemExit('Green CU sticky background still present')
if '[&_select]:!text-red-600' not in s:
    raise SystemExit('Red CU field text marker missing')

p.write_text(s, encoding='utf-8')
print('CU rows aligned with IVA: confirmed blue, CU Autonomi NO white/red')
