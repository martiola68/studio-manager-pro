from pathlib import Path

p = Path('src/pages/antiricicgio/modello-av4.tsx')
if not p.exists():
    p = Path('src/pages/antiriciclaggio/modello-av4.tsx')
s = p.read_text(encoding='utf-8')


def one(old: str, new: str, label: str) -> None:
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    s = s.replace(old, new, 1)

# Reuse exactly the same help modal component as the public AV4.
one(
'import TitolariEffettiviForm from "@/components/antiriciclaggio/TitolariEffettiviForm";\n',
'import TitolariEffettiviForm from "@/components/antiriciclaggio/TitolariEffettiviForm";\nimport AV4HelpButton from "@/components/antiriciclaggio/AV4HelpButton";\n',
'help import',
)

# Main cards: elegant sky border, same visual language as Soci/Organi.
s = s.replace('<Card>\n              <CardHeader>\n                <CardTitle>Dati principali</CardTitle>\n              </CardHeader>',
'''<Card className="border border-sky-200 shadow-sm">\n              <CardHeader>\n                <div className="flex items-center justify-between gap-3">\n                  <CardTitle>Dati principali</CardTitle>\n                  <AV4HelpButton topic="dati" />\n                </div>\n              </CardHeader>''', 1)

one(
'''            <Card className="mt-6">\n              <CardHeader>\n                <CardTitle>Dichiarazioni del cliente</CardTitle>\n              </CardHeader>''',
'''            <Card className="mt-6 border border-sky-200 shadow-sm">\n              <CardHeader>\n                <div className="flex items-center justify-between gap-3">\n                  <CardTitle>Dichiarazioni del cliente</CardTitle>\n                  <AV4HelpButton topic="dichiarazioni" />\n                </div>\n              </CardHeader>''',
'declarations card header',
)

# Wrap the first generic declarations in a neat sub-card.
one(
'''                <div className="space-y-6">\n                  <div>\n                    <label className="flex items-center gap-2">\n                      <input\n                        type="checkbox"\n                        name="domanda1"''',
'''                <div className="space-y-6">\n                  <section className="rounded-xl border border-sky-200 bg-white p-5">\n                    <div className="space-y-5">\n                  <div>\n                    <label className="flex items-center gap-2">\n                      <input\n                        type="checkbox"\n                        name="domanda1"''',
'open declarations subcard',
)

one(
'''                    />\n                  </div>\n\n                  <div className="font-semibold">Persona politicamente esposta</div>''',
'''                    />\n                  </div>\n                    </div>\n                  </section>\n\n                  <section className="rounded-xl border border-sky-200 bg-white p-5">\n                    <div className="mb-4 flex items-center justify-between gap-3">\n                      <div className="font-semibold text-slate-900">Persona politicamente esposta</div>\n                      <AV4HelpButton topic="ppe" />\n                    </div>\n                    <div className="space-y-5">''',
'open PPE subcard',
)

# Close PPE and open beneficial owner card before explanatory paragraph.
one(
'''                  {form.domanda5 && (\n                    <div>\n                      <label className="mb-1 block text-sm font-medium">\n                        Specificare carica pubblica, nome e legame con il titolare della carica pubblica\n                      </label>\n                      <textarea\n                        name="spec_domanda5"\n                        value={form.spec_domanda5}\n                        onChange={handleChange}\n                        className="w-full rounded-md border px-3 py-2"\n                        rows={3}\n                      />\n                    </div>\n                  )}\n\n                  <div className="text-sm leading-6 text-gray-700">''',
'''                  {form.domanda5 && (\n                    <div>\n                      <label className="mb-1 block text-sm font-medium">\n                        Specificare carica pubblica, nome e legame con il titolare della carica pubblica\n                      </label>\n                      <textarea\n                        name="spec_domanda5"\n                        value={form.spec_domanda5}\n                        onChange={handleChange}\n                        className="w-full rounded-md border px-3 py-2"\n                        rows={3}\n                      />\n                    </div>\n                  )}\n                    </div>\n                  </section>\n\n                  <section className="rounded-xl border border-sky-200 bg-white p-5">\n                    <div className="mb-4 flex items-center justify-between gap-3">\n                      <div className="font-semibold text-slate-900">Individuazione del titolare effettivo</div>\n                      <AV4HelpButton topic="titolare" />\n                    </div>\n                    <div className="space-y-5">\n                  <div className="text-sm leading-6 text-gray-700">''',
'beneficial owner subcard',
)

# Close beneficial-owner section and open PPE beneficial owners.
one(
'''                  {form.domanda9 && (\n                    <div className="space-y-4 rounded-lg border p-4">''',
'''                  {form.domanda9 && (\n                    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/40 p-4">''',
'restyle domanda9 inner',
)

one(
'''                  )}\n\n                  <div className="font-semibold">PPE titolari effettivi</div>\n\n                  <div>\n                    <label className="flex items-center gap-2">\n                      <input\n                        type="checkbox"\n                        name="domanda10"''',
'''                  )}\n                    </div>\n                  </section>\n\n                  <section className="rounded-xl border border-sky-200 bg-white p-5">\n                    <div className="mb-4 flex items-center justify-between gap-3">\n                      <div className="font-semibold text-slate-900">PPE titolari effettivi</div>\n                      <AV4HelpButton topic="ppeTitolari" />\n                    </div>\n                    <div className="space-y-5">\n                  <div>\n                    <label className="flex items-center gap-2">\n                      <input\n                        type="checkbox"\n                        name="domanda10"''',
'PPE beneficial owners subcard',
)

# Close PPE beneficial owners and open funds/relations card.
one(
'''                  {form.domanda11 && (\n                    <div>\n                      <label className="mb-1 block text-sm font-medium">Specifica PPE titolari effettivi</label>\n                      <textarea\n                        name="specifica12"\n                        value={form.specifica12}\n                        onChange={handleChange}\n                        className="w-full rounded-md border px-3 py-2"\n                        rows={3}\n                      />\n                    </div>\n                  )}\n\n                  <div>\n                    <label className="mb-1 block text-sm font-medium">\n                      Che le relazioni intercorrenti tra il Cliente e il titolare effettivo nonché, ove rilevi, l’esecutore sono''',
'''                  {form.domanda11 && (\n                    <div>\n                      <label className="mb-1 block text-sm font-medium">Specifica PPE titolari effettivi</label>\n                      <textarea\n                        name="specifica12"\n                        value={form.specifica12}\n                        onChange={handleChange}\n                        className="w-full rounded-md border px-3 py-2"\n                        rows={3}\n                      />\n                    </div>\n                  )}\n                    </div>\n                  </section>\n\n                  <section className="rounded-xl border border-sky-200 bg-white p-5">\n                    <div className="mb-4 flex items-center justify-between gap-3">\n                      <div className="font-semibold text-slate-900">Relazioni, fondi e mezzi di pagamento</div>\n                      <AV4HelpButton topic="fondi" />\n                    </div>\n                    <div className="space-y-5">\n                  <div>\n                    <label className="mb-1 block text-sm font-medium">\n                      Che le relazioni intercorrenti tra il Cliente e il titolare effettivo nonché, ove rilevi, l’esecutore sono''',
'funds subcard',
)

# Close funds and open activity card.
one(
'''                  <div className="text-sm leading-6 text-gray-700">\n                    Che i medesimi fondi e le risorse economiche eventualmente utilizzati non provengono né sono destinati a un’attività criminosa o al finanziamento del terrorismo di cui all’art. 2, co. 6, del D.Lgs. 231/2007.\n                  </div>\n\n                  <div className="font-semibold">Professione / attività del cliente</div>''',
'''                  <div className="text-sm leading-6 text-gray-700">\n                    Che i medesimi fondi e le risorse economiche eventualmente utilizzati non provengono né sono destinati a un’attività criminosa o al finanziamento del terrorismo di cui all’art. 2, co. 6, del D.Lgs. 231/2007.\n                  </div>\n                    </div>\n                  </section>\n\n                  <section className="rounded-xl border border-sky-200 bg-white p-5">\n                    <div className="mb-4 flex items-center justify-between gap-3">\n                      <div className="font-semibold text-slate-900">Professione / attività del cliente</div>\n                      <AV4HelpButton topic="attivita" />\n                    </div>\n                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">''',
'activity subcard',
)

# Activity fields are three sibling divs. Close grid and section after the territorial field.
one(
'''                  <div>\n                    <label className="mb-1 block text-sm font-medium">Nell’ambito territoriale</label>\n                    <input\n                      name="specifica10f"\n                      value={form.specifica10f}\n                      onChange={handleChange}\n                      className="w-full rounded-md border px-3 py-2"\n                    />\n                  </div>\n                </div>\n              </CardContent>''',
'''                  <div>\n                    <label className="mb-1 block text-sm font-medium">Nell’ambito territoriale</label>\n                    <input\n                      name="specifica10f"\n                      value={form.specifica10f}\n                      onChange={handleChange}\n                      className="w-full rounded-md border px-3 py-2"\n                    />\n                  </div>\n                    </div>\n                  </section>\n                </div>\n              </CardContent>''',
'close activity subcard',
)

# Titolari inner boxes become softer and more coherent; logic untouched.
s = s.replace('className="rounded-lg border p-4"', 'className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"')
s = s.replace('className="space-y-4 rounded-lg border p-4"', 'className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4"')

# Signature card gets the same style and same public help modal.
one(
'''            <Card className="mt-6">\n              <CardHeader>\n                <CardTitle>Firma</CardTitle>\n              </CardHeader>''',
'''            <Card className="mt-6 border border-sky-200 shadow-sm">\n              <CardHeader>\n                <div className="flex items-center justify-between gap-3">\n                  <CardTitle>Firma</CardTitle>\n                  <AV4HelpButton topic="firma" />\n                </div>\n              </CardHeader>''',
'signature card',
)

# Safety checks: no functional identifiers may be removed.
required = [
    'handleChange', 'salvaAV4', 'handleInvioPubblico', 'TitolariEffettiviForm',
    'domanda1', 'domanda3', 'domanda6', 'domanda10', 'specifica10b', 'specifica10d',
    'AV4HelpButton topic="dati"', 'AV4HelpButton topic="ppe"',
    'AV4HelpButton topic="titolare"', 'AV4HelpButton topic="firma"',
]
for marker in required:
    if marker not in s:
        raise SystemExit(f'missing safety marker: {marker}')

p.write_text(s, encoding='utf-8')
