from pathlib import Path

p = Path('src/components/payroll/PayrollMasterGraficaEnhancer.tsx')
s = p.read_text(encoding='utf-8')
old = s

marker = '''      /* Presenze: colora esclusivamente i campi giornalieri compilati in base al codice. */\n'''
override = '''      /* Override finale Smart Working: font realmente leggibile anche con scala UI compatta. */\n      .payroll-master-page.payroll-smart-groups-page { font-size: 17px !important; }\n      .payroll-master-page.payroll-smart-groups-page h1 { font-size: 24px !important; line-height: 1.3 !important; }\n      .payroll-master-page.payroll-smart-groups-page h2,\n      .payroll-master-page.payroll-smart-groups-page h3 { font-size: 18px !important; line-height: 1.3 !important; }\n      .payroll-master-page.payroll-smart-groups-page label { font-size: 16px !important; }\n      .payroll-master-page.payroll-smart-groups-page p,\n      .payroll-master-page.payroll-smart-groups-page span,\n      .payroll-master-page.payroll-smart-groups-page td,\n      .payroll-master-page.payroll-smart-groups-page th { font-size: 16px !important; line-height: 1.35 !important; }\n      .payroll-master-page.payroll-smart-groups-page input,\n      .payroll-master-page.payroll-smart-groups-page select,\n      .payroll-master-page.payroll-smart-groups-page textarea { font-size: 16px !important; min-height: 42px !important; }\n      .payroll-master-page.payroll-smart-groups-page button { font-size: 15px !important; min-height: 40px !important; }\n      .payroll-master-page.payroll-smart-groups-page table { font-size: 16px !important; }\n\n'''

# Rimuove eventuale precedente override finale per evitare conflitti.
start = s.find('      /* Override finale Smart Working:')
if start != -1:
    end = s.find(marker, start)
    if end == -1:
        raise SystemExit('presenze marker missing after old override')
    s = s[:start] + s[end:]

if marker not in s:
    raise SystemExit('presenze marker missing')
s = s.replace(marker, override + marker, 1)

if s == old:
    raise SystemExit('no changes')
p.write_text(s, encoding='utf-8')
