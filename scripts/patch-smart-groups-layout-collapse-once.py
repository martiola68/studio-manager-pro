from pathlib import Path

# ---------------------------------------------------------
# UI: riepilogo a scomparsa e card nuovo gruppo più compatta
# ---------------------------------------------------------
p = Path('src/pages/presenze/smart-gruppi.tsx')
s = p.read_text(encoding='utf-8')
old = s

# Card Nuovo/Modifica più compatta
s = s.replace(
    'className="border rounded-lg bg-white p-4 space-y-4"',
    'className="border rounded-lg bg-white p-3 space-y-3 smart-new-group-card"',
    1,
)

# Riepilogo gruppo a scomparsa, chiuso di default.
old_summary = '''            {gruppoCorrente && (
              <div className="space-y-3">
                <div className="text-gray-600">
                  Settore: <strong>{gruppoCorrente.settore}</strong> · Modalità:{" "}
                  <strong>{gruppoCorrente.scelta_libera ? "A scelta libera" : `Giorno fisso: ${giornoLabel(gruppoCorrente.giorno_fisso)}`}</strong>
                </div>
                <div className="border rounded-md bg-white overflow-hidden">
                  {(gruppoCorrente.utenti || []).map((rel) => {
                    const giorniUtente = rel.giorni_presenza || [];
                    const dettaglio = gruppoCorrente.scelta_libera
                      ? giorniUtente.length
                        ? giorniUtente.map(giornoLabel).join(", ")
                        : "Smart working tutta la settimana"
                      : `${gruppoCorrente.presenze_settimanali} presenze/settimana · ${giornoLabel(gruppoCorrente.giorno_fisso)} fisso`;
                    return (
                      <div key={rel.id} className="flex items-center justify-between gap-4 border-b last:border-b-0 px-3 py-2">
                        <strong>{nomeUtente(rel.utente)}</strong>
                        <span className="text-slate-600">{dettaglio}</span>
                      </div>
                    );
                  })}
                  {(gruppoCorrente.utenti || []).length === 0 && (
                    <div className="px-3 py-2 text-slate-500">Nessun utente associato.</div>
                  )}
                </div>
              </div>
            )}'''

new_summary = '''            {gruppoCorrente && (
              <details className="smart-group-summary rounded-md border border-sky-200 bg-white">
                <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-slate-700">
                  Riepilogo gruppo · {gruppoCorrente.settore} · {gruppoCorrente.scelta_libera ? "A scelta libera" : `Giorno fisso: ${giornoLabel(gruppoCorrente.giorno_fisso)}`}
                </summary>
                <div className="border-t border-sky-100">
                  {(gruppoCorrente.utenti || []).map((rel) => {
                    const giorniUtente = rel.giorni_presenza || [];
                    const dettaglio = gruppoCorrente.scelta_libera
                      ? giorniUtente.length
                        ? giorniUtente.map(giornoLabel).join(", ")
                        : "Smart working tutta la settimana"
                      : `${gruppoCorrente.presenze_settimanali} presenze/settimana · ${giornoLabel(gruppoCorrente.giorno_fisso)} fisso`;
                    return (
                      <div key={rel.id} className="flex items-center justify-between gap-4 border-b last:border-b-0 px-3 py-2">
                        <strong>{nomeUtente(rel.utente)}</strong>
                        <span className="text-slate-600">{dettaglio}</span>
                      </div>
                    );
                  })}
                  {(gruppoCorrente.utenti || []).length === 0 && (
                    <div className="px-3 py-2 text-slate-500">Nessun utente associato.</div>
                  )}
                </div>
              </details>
            )}'''

if 'className="smart-group-summary' not in s:
    if old_summary not in s:
        raise SystemExit('summary block mismatch')
    s = s.replace(old_summary, new_summary, 1)

# Identificatore card tabella per override grafico mirato.
s = s.replace(
    '<div className="border rounded-lg bg-white p-4">\n            <h2 className="font-semibold mb-3">Gruppi configurati</h2>',
    '<div className="border rounded-lg bg-white p-3 smart-groups-configured-card">\n            <h2 className="font-semibold mb-2">Gruppi configurati</h2>',
    1,
)

if s == old:
    raise SystemExit('no smart groups UI changes applied')

assert 'smart-group-summary' in s
assert 'smart-new-group-card' in s
assert 'smart-groups-configured-card' in s
p.write_text(s, encoding='utf-8')

# ---------------------------------------------------------
# Master grafica: recupero spazio + header tabella NON sticky
# ---------------------------------------------------------
p = Path('src/components/payroll/PayrollMasterGraficaEnhancer.tsx')
s = p.read_text(encoding='utf-8')
old = s

marker = '''      /* Presenze: colora esclusivamente i campi giornalieri compilati in base al codice. */\n'''
override = '''      /* Smart Working gruppi: layout compatto e tabella sempre leggibile. */\n      .payroll-master-page.payroll-smart-groups-page .smart-new-group-card {\n        padding: 12px !important;\n      }\n      .payroll-master-page.payroll-smart-groups-page .smart-new-group-card > :not([hidden]) ~ :not([hidden]) {\n        margin-top: 10px !important;\n      }\n      .payroll-master-page.payroll-smart-groups-page .smart-new-group-card input,\n      .payroll-master-page.payroll-smart-groups-page .smart-new-group-card select,\n      .payroll-master-page.payroll-smart-groups-page .smart-new-group-card button {\n        min-height: 38px !important;\n      }\n      .payroll-master-page.payroll-smart-groups-page .smart-group-summary summary {\n        min-height: 0 !important;\n      }\n      .payroll-master-page.payroll-smart-groups-page .smart-groups-configured-card {\n        padding: 12px !important;\n        overflow: visible !important;\n        min-height: 0 !important;\n        flex: 0 0 auto !important;\n      }\n      .payroll-master-page.payroll-smart-groups-page .smart-groups-configured-card table {\n        width: 100% !important;\n        table-layout: auto !important;\n      }\n      .payroll-master-page.payroll-smart-groups-page .smart-groups-configured-card thead {\n        position: static !important;\n        top: auto !important;\n        z-index: auto !important;\n      }\n      .payroll-master-page.payroll-smart-groups-page .smart-groups-configured-card th,\n      .payroll-master-page.payroll-smart-groups-page .smart-groups-configured-card td {\n        vertical-align: middle !important;\n      }\n\n'''

if 'Smart Working gruppi: layout compatto e tabella sempre leggibile.' not in s:
    if marker not in s:
        raise SystemExit('enhancer marker mismatch')
    s = s.replace(marker, override + marker, 1)

if s == old:
    raise SystemExit('no enhancer changes applied')

assert 'smart-groups-configured-card thead' in s
assert 'position: static !important' in s
assert 'min-height: 38px !important' in s
p.write_text(s, encoding='utf-8')
