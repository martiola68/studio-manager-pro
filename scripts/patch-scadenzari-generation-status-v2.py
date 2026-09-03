from pathlib import Path

p = Path('src/pages/impostazioni/scadenzari.tsx')
s = p.read_text(encoding='utf-8')


def one(old: str, new: str, label: str) -> None:
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    s = s.replace(old, new, 1)

one(
'''  const [showScadenzeModal, setShowScadenzeModal] = useState(false);\n\n  const [anniArchiviabili, setAnniArchiviabili] = useState<number[]>([]);''',
'''  const [showScadenzeModal, setShowScadenzeModal] = useState(false);\n  const [scadenzariGenerati, setScadenzariGenerati] = useState<\n    Partial<Record<keyof ScadenzariFlagsState, number>>\n  >({});\n  const [loadingStatoGenerazione, setLoadingStatoGenerazione] = useState(false);\n\n  const [anniArchiviabili, setAnniArchiviabili] = useState<number[]>([]);''',
'generation status state',
)

one(
'''  useEffect(() => {\n    setScadenzeAdempimento(buildDefaultScadenzeAdempimento(annoGenerazione));\n  }, [annoGenerazione]);\n\n  useEffect(() => {''',
'''  useEffect(() => {\n    setScadenzeAdempimento(buildDefaultScadenzeAdempimento(annoGenerazione));\n  }, [annoGenerazione]);\n\n  useEffect(() => {\n    if (!loading) {\n      void loadStatoGenerazione();\n    }\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [loading, annoGenerazione]);\n\n  useEffect(() => {''',
'generation status effect',
)

one(
'''  const scadenzariConData = useMemo(\n    () =>\n      SCADENZARI_CONFIG.filter(\n        (item) => item.hasScadenzaAdempimento && scadenzariFlags[item.key]\n      ),\n    [scadenzariFlags]\n  );''',
'''  const scadenzariConData = useMemo(\n    () =>\n      SCADENZARI_CONFIG.filter(\n        (item) =>\n          item.hasScadenzaAdempimento &&\n          scadenzariFlags[item.key] &&\n          (scadenzariGenerati[item.key] ?? 0) === 0\n      ),\n    [scadenzariFlags, scadenzariGenerati]\n  );''',
'pending schedules modal',
)

one(
'''  const getSelectedScadenzari = () =>\n    SCADENZARI_CONFIG.filter((item) => scadenzariFlags[item.key]);\n\n  const handleScadenzaChange = (''',
'''  const getSelectedScadenzari = () =>\n    SCADENZARI_CONFIG.filter((item) => scadenzariFlags[item.key]);\n\n  const isScadenzarioGenerato = (key: keyof ScadenzariFlagsState) =>\n    (scadenzariGenerati[key] ?? 0) > 0;\n\n  const isScadenzarioDaGenerare = (key: keyof ScadenzariFlagsState) =>\n    scadenzariFlags[key] && !isScadenzarioGenerato(key);\n\n  const loadStatoGenerazione = async () => {\n    try {\n      setLoadingStatoGenerazione(true);\n      const risultati = await Promise.all(\n        SCADENZARI_CONFIG.map(async (item) => {\n          const { count, error } = await supabase\n            .from(item.table as any)\n            .select("id", { count: "exact", head: true })\n            .eq("anno_riferimento", annoGenerazione);\n\n          if (error) throw error;\n          return [item.key, count ?? 0] as const;\n        })\n      );\n\n      setScadenzariGenerati(\n        Object.fromEntries(risultati) as Partial<\n          Record<keyof ScadenzariFlagsState, number>\n        >\n      );\n    } catch (error) {\n      console.error("Errore controllo scadenzari già generati:", error);\n      setScadenzariGenerati({});\n    } finally {\n      setLoadingStatoGenerazione(false);\n    }\n  };\n\n  const handleScadenzaChange = (''',
'generation status loader',
)

for key in ['iva', 'ccgg', 'cu', 'fiscali', 'bilanci', 'modello770']:
    old = f'if (scadenzariFlags.{key} && !scadenzeAdempimento.{key})'
    new = f'if (isScadenzarioDaGenerare("{key}") && !scadenzeAdempimento.{key})'
    if old not in s:
        raise SystemExit(f'validate marker missing: {key}')
    s = s.replace(old, new, 1)

for key in ['iva', 'ccgg', 'cu', 'fiscali', 'bilanci', 'modello770', 'lipe', 'esterometro', 'imu']:
    old = f'      if (scadenzariFlags.{key}) {{'
    new = f'      if (isScadenzarioDaGenerare("{key}")) {{'
    if old not in s:
        raise SystemExit(f'execute marker missing: {key}')
    s = s.replace(old, new, 1)

one(
'''      toast({\n        title: "Generazione completata",\n        description: `Generati ${generati} nuovi scadenzari per l'anno ${annoGenerazione}${\n          errori > 0 ? ` (${errori} errori)` : ""\n        }`,\n      });\n\n      setShowScadenzeModal(false);''',
'''      toast({\n        title: "Generazione completata",\n        description: `Generati ${generati} nuovi scadenzari per l'anno ${annoGenerazione}${\n          errori > 0 ? ` (${errori} errori)` : ""\n        }`,\n      });\n\n      await loadStatoGenerazione();\n      setShowScadenzeModal(false);''',
'refresh status after generation',
)

one(
'''    const scadenzariSelezionati = Object.entries(scadenzariFlags)\n      .filter(([_, selected]) => selected)\n      .map(([key]) => key);''',
'''    const scadenzariSelezionati = Object.entries(scadenzariFlags)\n      .filter(\n        ([key, selected]) =>\n          selected &&\n          !isScadenzarioGenerato(key as keyof ScadenzariFlagsState)\n      )\n      .map(([key]) => key);''',
'handle generate filter',
)

one(
'''        description: "Seleziona almeno uno scadenzario da generare",''',
'''        description: "Seleziona almeno uno scadenzario da generare non già presente per l'anno scelto",''',
'generate empty toast',
)

one(
'''                    <li>\n                      Alla generazione vengono salvati anche gli alert automatici\n                      a 15 e 7 giorni prima\n                    </li>\n''',
'',
'remove obsolete alerts copy',
)

old_ui = '''                  {SCADENZARI_CONFIG.map((item) => (\n                    <div\n                      key={`flag_${item.key}`}\n                      className="flex items-center space-x-2"\n                    >\n                      <Checkbox\n                        id={`flag_${item.key}`}\n                        checked={scadenzariFlags[item.key]}\n                        onCheckedChange={(checked) =>\n                          setScadenzariFlags({\n                            ...scadenzariFlags,\n                            [item.key]: checked as boolean,\n                          })\n                        }\n                      />\n                      <label\n                        htmlFor={`flag_${item.key}`}\n                        className="text-sm cursor-pointer"\n                      >\n                        {item.label}\n                      </label>\n                    </div>\n                  ))}'''
new_ui = '''                  {SCADENZARI_CONFIG.map((item) => {\n                    const numeroGenerati = scadenzariGenerati[item.key] ?? 0;\n                    const giaGenerato = numeroGenerati > 0;\n\n                    return (\n                      <div\n                        key={`flag_${item.key}`}\n                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${\n                          giaGenerato\n                            ? "border-green-200 bg-green-50"\n                            : "border-gray-200 bg-white"\n                        }`}\n                      >\n                        <div className="flex items-center space-x-2">\n                          <Checkbox\n                            id={`flag_${item.key}`}\n                            checked={giaGenerato ? false : scadenzariFlags[item.key]}\n                            disabled={giaGenerato || loadingStatoGenerazione}\n                            onCheckedChange={(checked) =>\n                              setScadenzariFlags({\n                                ...scadenzariFlags,\n                                [item.key]: checked as boolean,\n                              })\n                            }\n                          />\n                          <label\n                            htmlFor={`flag_${item.key}`}\n                            className={`text-sm ${\n                              giaGenerato\n                                ? "cursor-default font-medium text-green-800"\n                                : "cursor-pointer"\n                            }`}\n                          >\n                            {item.label}\n                          </label>\n                        </div>\n                        <span\n                          className={`whitespace-nowrap text-xs font-medium ${\n                            giaGenerato ? "text-green-700" : "text-gray-500"\n                          }`}\n                        >\n                          {loadingStatoGenerazione\n                            ? "Controllo..."\n                            : giaGenerato\n                            ? `✓ Generato — ${numeroGenerati}`\n                            : "Da generare"}\n                        </span>\n                      </div>\n                    );\n                  })}'''
one(old_ui, new_ui, 'generation status grid')

one(
'''              <Button\n                onClick={handleGenera}\n                disabled={processing}\n                className="w-full bg-green-600 hover:bg-green-700"''',
'''              <Button\n                onClick={handleGenera}\n                disabled={\n                  processing ||\n                  loadingStatoGenerazione ||\n                  !SCADENZARI_CONFIG.some((item) =>\n                    isScadenzarioDaGenerare(item.key)\n                  )\n                }\n                className="w-full bg-green-600 hover:bg-green-700"''',
'generation button guard',
)

p.write_text(s, encoding='utf-8')
