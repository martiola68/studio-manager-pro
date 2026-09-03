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
'''  const [scadenzariGenerati, setScadenzariGenerati] = useState<\n    Partial<Record<keyof ScadenzariFlagsState, number>>\n  >({});\n  const [loadingStatoGenerazione, setLoadingStatoGenerazione] = useState(false);''',
'''  const [scadenzariGenerati, setScadenzariGenerati] = useState<\n    Partial<Record<keyof ScadenzariFlagsState, number>>\n  >({});\n  const [loadingStatoGenerazione, setLoadingStatoGenerazione] = useState(false);\n  const [statoArchiviazione, setStatoArchiviazione] = useState<\n    Partial<Record<keyof ScadenzariFlagsState, { archiviati: number; attivi: number }>>\n  >({});\n  const [loadingStatoArchiviazione, setLoadingStatoArchiviazione] = useState(false);''',
'archive status state',
)

one(
'''  useEffect(() => {\n    if (!loading) {\n      void loadStatoGenerazione();\n    }\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [loading, annoGenerazione]);\n\n  useEffect(() => {''',
'''  useEffect(() => {\n    if (!loading) {\n      void loadStatoGenerazione();\n    }\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [loading, annoGenerazione]);\n\n  useEffect(() => {\n    if (!loading) {\n      void loadStatoArchiviazione();\n    }\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [loading, annoArchiviazione]);\n\n  useEffect(() => {''',
'archive status effect',
)

one(
'''  const isScadenzarioDaGenerare = (key: keyof ScadenzariFlagsState) =>\n    scadenzariFlags[key] && !isScadenzarioGenerato(key);\n\n  const loadStatoGenerazione = async () => {''',
'''  const isScadenzarioDaGenerare = (key: keyof ScadenzariFlagsState) =>\n    scadenzariFlags[key] && !isScadenzarioGenerato(key);\n\n  const getStatoArchiviazione = (key: keyof ScadenzariFlagsState) =>\n    statoArchiviazione[key] ?? { archiviati: 0, attivi: 0 };\n\n  const isScadenzarioDaArchiviare = (key: keyof ScadenzariFlagsState) =>\n    scadenzariFlags[key] && getStatoArchiviazione(key).attivi > 0;\n\n  const loadStatoArchiviazione = async () => {\n    try {\n      setLoadingStatoArchiviazione(true);\n      const risultati = await Promise.all(\n        SCADENZARI_CONFIG.map(async (item) => {\n          const [{ count: archiviati, error: errorArch }, { count: attivi, error: errorAtt }] =\n            await Promise.all([\n              supabase\n                .from(item.table as any)\n                .select("id", { count: "exact", head: true })\n                .eq("anno_riferimento", annoArchiviazione)\n                .eq("archiviato", true),\n              supabase\n                .from(item.table as any)\n                .select("id", { count: "exact", head: true })\n                .eq("anno_riferimento", annoArchiviazione)\n                .eq("archiviato", false),\n            ]);\n\n          if (errorArch) throw errorArch;\n          if (errorAtt) throw errorAtt;\n          return [\n            item.key,\n            { archiviati: archiviati ?? 0, attivi: attivi ?? 0 },\n          ] as const;\n        })\n      );\n\n      setStatoArchiviazione(\n        Object.fromEntries(risultati) as Partial<\n          Record<keyof ScadenzariFlagsState, { archiviati: number; attivi: number }>\n        >\n      );\n    } catch (error) {\n      console.error("Errore controllo stato archiviazione:", error);\n      setStatoArchiviazione({});\n    } finally {\n      setLoadingStatoArchiviazione(false);\n    }\n  };\n\n  const loadStatoGenerazione = async () => {''',
'archive status loader',
)

one(
'''  const handleArchivia = async () => {\n    const selezionati = getSelectedScadenzari();''',
'''  const handleArchivia = async () => {\n    const selezionati = SCADENZARI_CONFIG.filter((item) =>\n      isScadenzarioDaArchiviare(item.key)\n    );''',
'archive selected filter',
)

one(
'''        description: "Seleziona almeno uno scadenzario da archiviare",''',
'''        description: "Seleziona almeno uno scadenzario con record ancora da archiviare",''',
'archive empty toast',
)

one(
'''      toast({\n        title: "Successo",\n        description: `Archiviazione logica completata per l'anno ${annoArchiviazione}`,\n      });''',
'''      toast({\n        title: "Successo",\n        description: `Archiviazione logica completata per l'anno ${annoArchiviazione}`,\n      });\n\n      await loadStatoArchiviazione();\n      await loadAnniDisponibili();''',
'archive refresh',
)

old_ui = '''                  {SCADENZARI_CONFIG.map((item) => (\n                    <div\n                      key={`arch_${item.key}`}\n                      className="flex items-center space-x-2"\n                    >\n                      <Checkbox\n                        id={`arch_${item.key}`}\n                        checked={scadenzariFlags[item.key]}\n                        onCheckedChange={(checked) =>\n                          setScadenzariFlags({\n                            ...scadenzariFlags,\n                            [item.key]: checked as boolean,\n                          })\n                        }\n                      />\n                      <label\n                        htmlFor={`arch_${item.key}`}\n                        className="text-sm cursor-pointer"\n                      >\n                        {item.label}\n                      </label>\n                    </div>\n                  ))}'''
new_ui = '''                  {SCADENZARI_CONFIG.map((item) => {\n                    const { archiviati, attivi } = getStatoArchiviazione(item.key);\n                    const completamenteArchiviato = archiviati > 0 && attivi === 0;\n                    const parziale = archiviati > 0 && attivi > 0;\n                    const nessunRecord = archiviati === 0 && attivi === 0;\n                    const disabilitato =\n                      completamenteArchiviato || nessunRecord || loadingStatoArchiviazione;\n\n                    return (\n                      <div\n                        key={`arch_${item.key}`}\n                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${\n                          completamenteArchiviato\n                            ? "border-blue-200 bg-blue-50"\n                            : parziale\n                            ? "border-amber-200 bg-amber-50"\n                            : "border-gray-200 bg-white"\n                        }`}\n                      >\n                        <div className="flex items-center space-x-2">\n                          <Checkbox\n                            id={`arch_${item.key}`}\n                            checked={disabilitato ? false : scadenzariFlags[item.key]}\n                            disabled={disabilitato}\n                            onCheckedChange={(checked) =>\n                              setScadenzariFlags({\n                                ...scadenzariFlags,\n                                [item.key]: checked as boolean,\n                              })\n                            }\n                          />\n                          <label\n                            htmlFor={`arch_${item.key}`}\n                            className={`text-sm ${\n                              disabilitato ? "cursor-default" : "cursor-pointer"\n                            }`}\n                          >\n                            {item.label}\n                          </label>\n                        </div>\n                        <span\n                          className={`whitespace-nowrap text-xs font-medium ${\n                            completamenteArchiviato\n                              ? "text-blue-700"\n                              : parziale\n                              ? "text-amber-700"\n                              : "text-gray-500"\n                          }`}\n                        >\n                          {loadingStatoArchiviazione\n                            ? "Controllo..."\n                            : completamenteArchiviato\n                            ? `✓ Archiviato — ${archiviati}`\n                            : parziale\n                            ? `Parziale — ${archiviati} arch. / ${attivi} da arch.`\n                            : nessunRecord\n                            ? "Nessun record"\n                            : `Da archiviare — ${attivi}`}\n                        </span>\n                      </div>\n                    );\n                  })}'''
one(old_ui, new_ui, 'archive status grid')

one(
'''                disabled={processing || anniArchiviabili.length === 0}\n                className="w-full bg-blue-600 hover:bg-blue-700"''',
'''                disabled={\n                  processing ||\n                  loadingStatoArchiviazione ||\n                  anniArchiviabili.length === 0 ||\n                  !SCADENZARI_CONFIG.some((item) =>\n                    isScadenzarioDaArchiviare(item.key)\n                  )\n                }\n                className="w-full bg-blue-600 hover:bg-blue-700"''',
'archive button guard',
)

p.write_text(s, encoding='utf-8')
