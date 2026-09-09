from pathlib import Path

# 1) API gruppi: fallback legacy se la migration scelta_libera non è ancora applicata.
p = Path('src/pages/api/presenze/smart/gruppi.ts')
s = p.read_text(encoding='utf-8')
old = s

old_get = '''  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("tbpresenze_smart_gruppi")
      .select(`
        *,
        utenti:tbpresenze_smart_gruppi_utenti(
          id,
          utente_id,
          ordine,
          giorni_presenza,
          utente:tbutenti(id, nome, cognome, email, settore, tipo_rapporto)
        )
      `)
      .eq("attivo", true)
      .order("settore", { ascending: true });

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    return res.status(200).json(data || []);
  }
'''

new_get = '''  if (req.method === "GET") {
    const enhanced = await supabaseAdmin
      .from("tbpresenze_smart_gruppi")
      .select(`
        *,
        utenti:tbpresenze_smart_gruppi_utenti(
          id,
          utente_id,
          ordine,
          giorni_presenza,
          utente:tbutenti(id, nome, cognome, email, settore, tipo_rapporto)
        )
      `)
      .eq("attivo", true)
      .order("settore", { ascending: true });

    if (!enhanced.error) {
      return res.status(200).json(enhanced.data || []);
    }

    // Compatibilità con il DB precedente: i gruppi esistenti devono continuare
    // ad essere visibili anche prima dell'esecuzione della migration scelta_libera.
    const legacy = await supabaseAdmin
      .from("tbpresenze_smart_gruppi")
      .select(`
        *,
        utenti:tbpresenze_smart_gruppi_utenti(
          id,
          utente_id,
          ordine,
          utente:tbutenti(id, nome, cognome, email, settore, tipo_rapporto)
        )
      `)
      .eq("attivo", true)
      .order("settore", { ascending: true });

    if (legacy.error) {
      return res.status(500).json({ error: legacy.error.message });
    }

    return res.status(200).json(
      (legacy.data || []).map((gruppo: any) => ({
        ...gruppo,
        scelta_libera: false,
        utenti: (gruppo.utenti || []).map((utente: any) => ({
          ...utente,
          giorni_presenza: null,
        })),
      }))
    );
  }
'''

if old_get not in s:
    raise SystemExit('GET gruppi marker mismatch')
s = s.replace(old_get, new_get, 1)
p.write_text(s, encoding='utf-8')

# 2) Font Smart Working: incremento realmente visibile ma moderato.
p = Path('src/components/payroll/PayrollMasterGraficaEnhancer.tsx')
s = p.read_text(encoding='utf-8')
old = s

repls = {
  '.payroll-smart-groups-page table { width: 100% !important; font-size: .82rem !important; }': '.payroll-smart-groups-page table { width: 100% !important; font-size: .90rem !important; }',
  '.payroll-smart-groups-page input, .payroll-smart-groups-page select { font-size: .86rem !important; }': '.payroll-smart-groups-page input, .payroll-smart-groups-page select { font-size: .94rem !important; }',
  '.payroll-smart-groups-page button { font-size: .82rem !important; }': '.payroll-smart-groups-page button { font-size: .88rem !important; }',
  '.payroll-smart-groups-page h2, .payroll-smart-groups-page h3 { font-size: .92rem !important; }': '.payroll-smart-groups-page h2, .payroll-smart-groups-page h3 { font-size: 1rem !important; }',
}
for a,b in repls.items():
    if a not in s:
        raise SystemExit('font marker missing: '+a)
    s = s.replace(a,b,1)

# Label e testo descrittivo della sola pagina Smart Working.
needle = '.payroll-smart-groups-page h2, .payroll-smart-groups-page h3 { font-size: 1rem !important; }\n'
extra = needle + '      .payroll-smart-groups-page label { font-size: .88rem !important; }\n      .payroll-smart-groups-page p, .payroll-smart-groups-page span { font-size: .90rem; }\n'
s = s.replace(needle, extra, 1)
p.write_text(s, encoding='utf-8')
