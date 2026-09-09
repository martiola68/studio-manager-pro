from pathlib import Path

# --- API gruppi --------------------------------------------------------------
p = Path('src/pages/api/presenze/smart/gruppi.ts')
s = p.read_text(encoding='utf-8')
old = s
s = s.replace('''          ordine,\n          utente:tbutenti''','''          ordine,\n          giorni_presenza,\n          utente:tbutenti''')
s = s.replace('''      presenze_settimanali,\n      utenti,\n    } = req.body;''','''      presenze_settimanali,\n      scelta_libera,\n      utenti,\n    } = req.body;''')
s = s.replace('''        presenze_settimanali: presenze_settimanali || 2,\n      })''','''        presenze_settimanali: presenze_settimanali || 2,\n        scelta_libera: !!scelta_libera,\n      })''')
s = s.replace('''      const rows = utenti.map((utente_id: string, index: number) => ({\n        gruppo_id: gruppo.id,\n        utente_id,\n        ordine: index,\n      }));''','''      const rows = utenti.map((item: any, index: number) => {\n        const utente_id = typeof item === "string" ? item : item.utente_id;\n        const giorni = Array.isArray(item?.giorni_presenza)\n          ? item.giorni_presenza.map(Number).filter((g: number) => g >= 1 && g <= 5)\n          : null;\n\n        return {\n          gruppo_id: gruppo.id,\n          utente_id,\n          ordine: index,\n          giorni_presenza: !!scelta_libera ? giorni : null,\n        };\n      });''')
if s != old: p.write_text(s, encoding='utf-8')

# --- Generazione mese --------------------------------------------------------
p = Path('src/pages/api/presenze/smart/genera-mese.ts')
s = p.read_text(encoding='utf-8')
old = s
s = s.replace('.select("utente_id, ordine")', '.select("utente_id, ordine, giorni_presenza")', 1)
s = s.replace('''    const presenza =\n      !festivoNome &&\n      (wd === giornoFisso || userIndex === extraIndex);''','''    const giorniUtente = Array.isArray((utente as any).giorni_presenza)\n      ? (utente as any).giorni_presenza.map(Number)\n      : [];\n\n    const presenza = !festivoNome && (\n      gruppo.scelta_libera\n        ? giorniUtente.includes(wd)\n        : (wd === giornoFisso || userIndex === extraIndex)\n    );''')
if s != old: p.write_text(s, encoding='utf-8')

# --- UI ---------------------------------------------------------------------
p = Path('src/pages/presenze/smart-gruppi.tsx')
s = p.read_text(encoding='utf-8')
old = s
s = s.replace('''  giorno_fisso: number;\n  presenze_settimanali: number;''','''  giorno_fisso: number;\n  presenze_settimanali: number;\n  scelta_libera?: boolean;''')
s = s.replace('''    ordine: number;\n    utente?: Utente;''','''    ordine: number;\n    giorni_presenza?: number[] | null;\n    utente?: Utente;''')
s = s.replace('''  const [utenteDaAggiungere, setUtenteDaAggiungere] = useState("");''','''  const [utenteDaAggiungere, setUtenteDaAggiungere] = useState("");\n  const [giorniPerUtente, setGiorniPerUtente] = useState<Record<string, number[]>>({});''')
s = s.replace('''    presenze_settimanali: 2,\n  });''','''    presenze_settimanali: 2,\n    scelta_libera: false,\n  });''')
s = s.replace('''  function rimuoviUtente(id: string) {\n    setUtentiSelezionati((prev) => prev.filter((x) => x !== id));\n  }''','''  function rimuoviUtente(id: string) {\n    setUtentiSelezionati((prev) => prev.filter((x) => x !== id));\n    setGiorniPerUtente((prev) => {\n      const next = { ...prev };\n      delete next[id];\n      return next;\n    });\n  }\n\n  function toggleGiornoUtente(utenteId: string, giorno: number) {\n    setGiorniPerUtente((prev) => {\n      const current = prev[utenteId] || [];\n      const next = current.includes(giorno)\n        ? current.filter((g) => g !== giorno)\n        : [...current, giorno].sort((a, b) => a - b);\n      return { ...prev, [utenteId]: next };\n    });\n  }''')
s = s.replace('''    if (utentiSelezionati.length === 0) {\n      alert("Seleziona almeno un utente");\n      return;\n    }''','''    if (utentiSelezionati.length === 0) {\n      alert("Seleziona almeno un utente");\n      return;\n    }\n\n    if (form.scelta_libera) {\n      const senzaGiorni = utentiSelezionati.filter((id) => !(giorniPerUtente[id] || []).length);\n      if (senzaGiorni.length > 0) {\n        alert("Per la scelta libera seleziona almeno un giorno di presenza per ogni utente");\n        return;\n      }\n    }''')
s = s.replace('''          utenti: utentiSelezionati,\n        }),''','''          utenti: utentiSelezionati.map((utente_id) => ({\n            utente_id,\n            giorni_presenza: form.scelta_libera ? (giorniPerUtente[utente_id] || []) : null,\n          })),\n        }),''')
s = s.replace('''      setUtentiSelezionati([]);\n      setGruppoSelezionato(data.id);''','''      setUtentiSelezionati([]);\n      setGiorniPerUtente({});\n      setGruppoSelezionato(data.id);''')
s = s.replace('''          <select\n            className="border p-2 rounded w-full"\n            value={form.giorno_fisso}\n            onChange={(e) =>\n              setForm({ ...form, giorno_fisso: Number(e.target.value) })\n            }\n          >''','''          <select\n            className="border p-2 rounded w-full"\n            value={form.scelta_libera ? "libera" : String(form.giorno_fisso)}\n            onChange={(e) => {\n              if (e.target.value === "libera") {\n                setForm({ ...form, scelta_libera: true });\n              } else {\n                setForm({ ...form, scelta_libera: false, giorno_fisso: Number(e.target.value) });\n              }\n            }}\n          >\n            <option value="libera">A scelta libera</option>''')
# hide weekly count in free mode
s = s.replace('''          <select\n            className="border p-2 rounded w-full"\n            value={form.presenze_settimanali}''','''          {!form.scelta_libera && <select\n            className="border p-2 rounded w-full"\n            value={form.presenze_settimanali}''')
s = s.replace('''            <option value={3}>3 giorni presenza/settimana</option>\n          </select>\n\n          <div className="border rounded p-3 space-y-3">''','''            <option value={3}>3 giorni presenza/settimana</option>\n          </select>}\n\n          <div className="border rounded p-3 space-y-3">''')
# user rows with weekday checkboxes
old_user='''                <span>{nomeUtente(u)}</span>\n\n                <button\n                  type="button"\n                  onClick={() => rimuoviUtente(u.id)}'''
new_user='''                <div className="min-w-0 flex-1">\n                  <div className="font-medium">{nomeUtente(u)}</div>\n                  {form.scelta_libera && (\n                    <div className="mt-2 flex flex-wrap gap-2">\n                      {giorni.map((g) => (\n                        <label key={g.value} className="inline-flex items-center gap-1.5 rounded border bg-slate-50 px-2 py-1">\n                          <input\n                            type="checkbox"\n                            checked={(giorniPerUtente[u.id] || []).includes(g.value)}\n                            onChange={() => toggleGiornoUtente(u.id, g.value)}\n                          />\n                          <span>{g.label.slice(0, 3)}</span>\n                        </label>\n                      ))}\n                    </div>\n                  )}\n                </div>\n\n                <button\n                  type="button"\n                  onClick={() => rimuoviUtente(u.id)}'''
s = s.replace(old_user,new_user)
# layout: table full width
s = s.replace('''      <div className="grid grid-cols-1 xl:grid-cols-[430px_1fr] gap-6 items-start">''','''      <div className="grid grid-cols-1 xl:grid-cols-[minmax(340px,38%)_1fr] gap-4 items-start">''')
# close right management after its card, then table full width
needle='''            )}\n          </div>\n\n          <div className="border rounded-lg bg-white p-4">\n            <h2 className="font-semibold mb-3">Gruppi configurati</h2>'''
replacement='''            )}\n          </div>\n        </div>\n      </div>\n\n      <div className="border rounded-lg bg-white p-4">\n            <h2 className="font-semibold mb-3">Gruppi configurati</h2>'''
s=s.replace(needle,replacement)
# remove old closing wrappers at end
s=s.replace('''          </div>\n        </div>\n      </div>\n    </div>\n  );\n}''','''      </div>\n    </div>\n  );\n}''')
# labels/table for free mode
s=s.replace('''<strong>{giornoLabel(gruppoCorrente.giorno_fisso)}</strong> ·''','''<strong>{gruppoCorrente.scelta_libera ? "A scelta libera" : giornoLabel(gruppoCorrente.giorno_fisso)}</strong> ·''')
s=s.replace('''<td className="border p-2">{giornoLabel(g.giorno_fisso)}</td>''','''<td className="border p-2">{g.scelta_libera ? "A scelta libera" : giornoLabel(g.giorno_fisso)}</td>''')
# slightly larger local typography
s=s.replace('''    <div className="p-6 space-y-6">''','''    <div className="p-6 space-y-6 text-[14px]">''')
s=s.replace('''<p className="text-sm text-gray-600">''','''<p className="text-[14px] text-gray-600">''')
s=s.replace('''<h3 className="font-semibold text-sm">Utenti gruppo</h3>''','''<h3 className="font-semibold text-[14px]">Utenti gruppo</h3>''')
if s == old: raise SystemExit('smart-gruppi UI markers did not match')
p.write_text(s, encoding='utf-8')

# --- Master grafica: typography only; layout is now explicit in page ----------
p=Path('src/components/payroll/PayrollMasterGraficaEnhancer.tsx')
s=p.read_text(encoding='utf-8'); old=s
s=s.replace('''.payroll-smart-groups-page .grid.grid-cols-1.xl\\:grid-cols-\\[430px_1fr\\] {\n        display: grid !important; grid-template-columns: minmax(420px, 36%) minmax(0, 64%) !important;''','''.payroll-smart-groups-page .grid.grid-cols-1.xl\\:grid-cols-\\[minmax\\(340px\\,38\\%\\)_1fr\\] {\n        display: grid !important; grid-template-columns: minmax(340px, 38%) minmax(0, 62%) !important;''')
s=s.replace('''.payroll-smart-groups-page .grid.grid-cols-1.xl\\:grid-cols-\\[430px_1fr\\] > div:first-child,\n      .payroll-smart-groups-page .grid.grid-cols-1.xl\\:grid-cols-\\[430px_1fr\\] > div.space-y-4 > div {''','''.payroll-smart-groups-page .grid.grid-cols-1.xl\\:grid-cols-\\[minmax\\(340px\\,38\\%\\)_1fr\\] > div:first-child,\n      .payroll-smart-groups-page .grid.grid-cols-1.xl\\:grid-cols-\\[minmax\\(340px\\,38\\%\\)_1fr\\] > div.space-y-4 > div {''')
s=s.replace('''.payroll-smart-groups-page .grid.grid-cols-1.xl\\:grid-cols-\\[430px_1fr\\] > div.space-y-4 {''','''.payroll-smart-groups-page .grid.grid-cols-1.xl\\:grid-cols-\\[minmax\\(340px\\,38\\%\\)_1fr\\] > div.space-y-4 {''')
s=s.replace('''.payroll-smart-groups-page table { width: 100% !important; }''','''.payroll-smart-groups-page table { width: 100% !important; font-size: .82rem !important; }\n      .payroll-smart-groups-page input, .payroll-smart-groups-page select { font-size: .86rem !important; }\n      .payroll-smart-groups-page button { font-size: .82rem !important; }\n      .payroll-smart-groups-page h2, .payroll-smart-groups-page h3 { font-size: .92rem !important; }''')
s=s.replace('''.payroll-smart-groups-page .grid.grid-cols-1.xl\\:grid-cols-\\[430px_1fr\\] { grid-template-columns: 1fr !important; }''','''.payroll-smart-groups-page .grid.grid-cols-1.xl\\:grid-cols-\\[minmax\\(340px\\,38\\%\\)_1fr\\] { grid-template-columns: 1fr !important; }''')
if s != old: p.write_text(s, encoding='utf-8')

print('Smart working free-choice patch applied')
