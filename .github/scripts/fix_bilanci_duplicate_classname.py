from pathlib import Path

p = Path('src/pages/scadenze/bilanci.tsx')
s = p.read_text(encoding='utf-8')
old = '''                          rows={1}\n                          className="h-8 min-h-8 resize-none border-slate-300 bg-white py-1.5"\n                          className="min-h-[60px] resize-none"\n'''
new = '''                          rows={1}\n                          className="h-8 min-h-8 resize-none border-slate-300 bg-white py-1.5"\n'''
if old not in s:
    raise SystemExit('duplicate className block not found')
s = s.replace(old, new, 1)
if 'className="h-8 min-h-8 resize-none border-slate-300 bg-white py-1.5"\n                          className=' in s:
    raise SystemExit('duplicate className still present')
p.write_text(s, encoding='utf-8')
print('Bilanci duplicate className fixed')
